import { Router } from 'express'
import { z } from 'zod'
import { member } from './auth.js'
import { db } from './db.js'
import { ensure } from './errors.js'
import { reasonInput } from './validation.js'
import { advanceQueue, holderStates, withItem } from './queue.js'

import { closeItem } from './management.js'
export const moderation = Router()
moderation.post('/items/:id/report', async (req, res) => {
  const user = await member(req),
    { reason } = reasonInput.parse(req.body)
  await withItem(req.params.id, async (tx, item) => {
    ensure(!item.hiddenAt && !item.archivedAt, 404, 'ประกาศนี้เปิดดูไม่ได้')
    await tx.report.create({
      data: { itemId: item.id, userId: user.id, reason },
    })
  })
  res.status(201).json({ reported: true })
})
moderation.get('/admin/reports', async (req, res) => {
  const user = await member(req)
  ensure(user.role === 'ADMIN', 403, 'เฉพาะผู้ดูแล')
  res.json(
    await db.report.findMany({
      select: {
        id: true,
        reason: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        item: {
          select: {
            id: true,
            title: true,
            hiddenAt: true,
            state: true,
            decisions: {
              select: { action: true, reason: true, createdAt: true },
              orderBy: { id: 'desc' },
            },
          },
        },
      },
      orderBy: { id: 'desc' },
    }),
  )
})
moderation.patch('/admin/items/:id', async (req, res) => {
  const user = await member(req)
  ensure(user.role === 'ADMIN', 403, 'เฉพาะผู้ดูแล')
  const { reason, action } = reasonInput
    .extend({ action: z.enum(['hide', 'restore', 'close']) })
    .parse(req.body)
  await withItem(req.params.id, async (tx, item, now) => {
    ensure(item.state !== 'CLOSED', 409, 'ประกาศปิดแล้ว')
    if (action === 'close') await closeItem(tx, item, reason)
    if (action === 'hide') {
      ensure(!item.hiddenAt, 409, 'ประกาศถูกซ่อนอยู่แล้ว')
      await tx.item.update({
        where: { id: item.id },
        data: { hiddenAt: now, reason },
      })
    }
    if (action === 'restore') {
      ensure(item.hiddenAt, 409, 'ประกาศเปิดดูได้อยู่แล้ว')
      const elapsed = now.getTime() - item.hiddenAt.getTime()
      const needsWindow =
        !!item.endsAt && item.endsAt <= now && item.state !== 'GIVEN'
      const holder = await tx.claim.findFirst({
        where: { itemId: item.id, state: { in: [...holderStates] } },
      })
      const updated = await tx.item.update({
        where: { id: item.id },
        data: { hiddenAt: null, needsWindow, reason },
      })
      if (holder) {
        const deadline =
          holder.deadline &&
          new Date(
            Math.min(
              holder.deadline.getTime() + elapsed,
              item.endsAt?.getTime() ?? Infinity,
            ),
          )
        await tx.claim.update({
          where: { id: holder.id },
          data: {
            state:
              needsWindow && holder.state !== 'OFFERED'
                ? 'RESCHEDULE'
                : holder.state,
            deadline: needsWindow ? null : deadline,
            reason,
          },
        })
      } else await advanceQueue(tx, updated, now)
    }
    await tx.decision.create({
      data: { itemId: item.id, adminId: user.id, reason, action },
    })
  })
  res.sendStatus(204)
})
