import { Router } from 'express'
import { z } from 'zod'
import { db } from './db.js'
import { member } from './auth.js'
import { ensure } from './errors.js'

import {
  advanceQueue,
  offerDeadline,
  activeStates,
  holderStates,
  hour,
  openWindow,
  withItem,
  type Transaction,
} from './queue.js'
import { newWindow, reasonInput, validWindow } from './validation.js'
import { readItemForm } from './photos.js'
import { publicFields } from './presentation.js'
import type { Item } from '@prisma/client'
export const management = Router()
function owner(item: Item, id: string) {
  ensure(item.ownerId === id, 403, 'เฉพาะเจ้าของประกาศเท่านั้น')
}
function mutable(item: Item) {
  ensure(
    !item.hiddenAt && ['OPEN', 'RESERVED'].includes(item.state),
    409,
    'สถานะประกาศไม่อนุญาตให้ทำรายการ',
  )
}
export async function closeItem(tx: Transaction, item: Item, reason: string) {
  ensure(
    item.state !== 'GIVEN' && item.state !== 'CLOSED',
    409,
    'ประกาศนี้สิ้นสุดแล้ว',
  )
  await tx.claim.updateMany({
    where: { itemId: item.id, state: { in: [...activeStates] } },
    data: { state: 'ENDED', deadline: null, reason },
  })
  await tx.item.update({
    where: { id: item.id },
    data: { state: 'CLOSED', reason, hiddenAt: null, needsWindow: false },
  })
}
management.get('/saved/:id', async (req, res) => {
  const item = await db.item.findFirst({
    where: { id: req.params.id, hiddenAt: null, archivedAt: null },
    select: publicFields,
  })
  res.json(item)
})
management.put('/items/:id', async (req, res) => {
  const user = await member(req)
  const {
    data: { rights: _rights, ...data },
    photo,
  } = await readItemForm(req, res)
  const result = await withItem(req.params.id, async (tx, item) => {
    owner(item, user.id)
    mutable(item)
    const changed =
      item.startsAt?.getTime() !==
        (data.startsAt ? Date.parse(data.startsAt) : undefined) ||
      item.endsAt?.getTime() !==
        (data.endsAt ? Date.parse(data.endsAt) : undefined)
    if (changed) {
      ensure(validWindow(data), 422, 'ช่วงเวลานัดรับไม่ถูกต้อง')
      ensure(
        !(await tx.claim.count({ where: { itemId: item.id } })),
        409,
        'ใช้เมนูกำหนดนัดใหม่เพื่อแจ้งผู้ขอรับ',
      )
    }
    return tx.item.update({
      where: { id: item.id },
      data: {
        ...data,
        image: photo ? '/api/photos/' + photo.id : data.image,
        photo: photo
          ? { upsert: { create: photo, update: photo } }
          : data.image && item.image.startsWith('/api/photos/')
            ? { delete: true }
            : undefined,
      },
      select: { id: true },
    })
  })
  res.json(result)
})
management.delete('/items/:id', async (req, res) => {
  const user = await member(req)
  await withItem(req.params.id, async (tx, item) => {
    owner(item, user.id)
    ensure(!item.hiddenAt, 409, 'ประกาศอยู่ระหว่างตรวจสอบ')
    ensure(
      !(await tx.claim.count({ where: { itemId: item.id } })),
      409,
      'ประกาศมีประวัติคำขอ กรุณาปิดพร้อมเหตุผล',
    )
    await tx.item.delete({ where: { id: item.id } })
  })
  res.sendStatus(204)
})
management.patch('/items/:id/archive', async (req, res) => {
  const user = await member(req)
  await withItem(req.params.id, async (tx, item, now) => {
    owner(item, user.id)
    ensure(['GIVEN', 'CLOSED'].includes(item.state), 409, 'นำออกได้เมื่อส่งต่อแล้วหรือปิดประกาศแล้ว')
    if (!item.archivedAt) await tx.item.update({ where: { id: item.id }, data: { archivedAt: now } })
  })
  res.sendStatus(204)
})
management.patch('/items/:id/close', async (req, res) => {
  const user = await member(req),
    { reason } = reasonInput.parse(req.body)
  await withItem(req.params.id, async (tx, item) => {
    owner(item, user.id)
    mutable(item)
    await closeItem(tx, item, reason)
  })
  res.sendStatus(204)
})
management.get('/items/:id/history', async (req, res) => {
  const user = await member(req)
  const list = await withItem(req.params.id, async (tx, item) => {
    owner(item, user.id)
    return tx.claim.findMany({
      where: { itemId: item.id },
      select: {
        id: true,
        state: true,
        reason: true,
        deadline: true,
        user: { select: { name: true } },
      },
      orderBy: { id: 'asc' },
    })
  })
  res.json(list)
})
management.patch('/items/:id/window', async (req, res) => {
  const user = await member(req),
    data = newWindow.parse(req.body)
  await withItem(req.params.id, async (tx, item, now) => {
    owner(item, user.id)
    mutable(item)
    const holder = await tx.claim.findFirst({
      where: { itemId: item.id, state: { in: [...holderStates] } },
    })
    const updated = await tx.item.update({
      where: { id: item.id },
      data: { ...data, needsWindow: false },
    })
    if (holder) {
      const upperBound =
        holder.state === 'CONFIRMED' && !item.endsAt && updated.endsAt
          ? updated.endsAt
          : offerDeadline(now, updated.endsAt)
      const deadline = new Date(
        Math.min(upperBound.getTime(), holder.deadline?.getTime() ?? Infinity),
      )
      await tx.claim.update({
        where: { id: holder.id },
        data: {
          state: holder.state === 'OFFERED' ? 'OFFERED' : 'RESCHEDULE',
          reason: data.reason,
          deadline,
        },
      })
    } else await advanceQueue(tx, updated, now)
  })
  res.sendStatus(204)
})
management.patch('/items/:id/claims/:claimId', async (req, res) => {
  const user = await member(req),
    { action } = z
      .object({ action: z.enum(['accept', 'withdraw', 'missed', 'complete']) })
      .parse(req.body)
  const claimId = z.coerce.number().int().positive().parse(req.params.claimId)
  await withItem(req.params.id, async (tx, item, now) => {
    mutable(item)
    const claim = await tx.claim.findFirst({
      where: { id: claimId, itemId: item.id },
    })
    ensure(
      claim && activeStates.some((s) => s === claim.state),
      409,
      'คำขอนี้สิ้นสุดแล้ว',
    )
    ensure(!claim.deadline || claim.deadline > now, 409, 'หมดเวลาทำรายการแล้ว')
    if (action === 'accept') {
      ensure(claim.userId === user.id, 403, 'เฉพาะผู้ได้รับข้อเสนอ')
      ensure(
        ['OFFERED', 'RESCHEDULE'].includes(claim.state) &&
          openWindow(item, now),
        409,
        'ยังยืนยันข้อเสนอนี้ไม่ได้',
      )
      await tx.claim.update({
        where: { id: claimId },
        data: {
          state: 'CONFIRMED',
          deadline: item.endsAt ? null : new Date(now.getTime() + 48 * hour),
          reason: 'ยืนยันสิทธิ์และเงื่อนไขการนัดแล้ว',
        },
      })
    } else if (action === 'complete') {
      owner(item, user.id)
      ensure(
        claim.state === 'CONFIRMED' && !!item.startsAt && !item.needsWindow,
        409,
        'ต้องยืนยันเวลานัดรับก่อนส่งมอบ',
      )
      await tx.claim.update({
        where: { id: claimId },
        data: {
          state: 'COMPLETED',
          deadline: null,
          reason: 'เจ้าของยืนยันการส่งมอบแล้ว',
        },
      })
      await tx.claim.updateMany({
        where: { itemId: item.id, state: 'WAITING' },
        data: { state: 'ENDED', reason: 'สิ่งของส่งต่อแล้ว' },
      })
      await tx.item.update({
        where: { id: item.id },
        data: { state: 'GIVEN', reason: null },
      })
    } else {
      if (action === 'withdraw')
        ensure(claim.userId === user.id, 403, 'เฉพาะผู้ขอรับรายนี้')
      else {
        owner(item, user.id)
        ensure(
          claim.state === 'CONFIRMED' &&
            item.endsAt &&
            item.endsAt <= now &&
            !item.needsWindow,
          409,
          'ยังไม่เลยช่วงนัดที่ยืนยันร่วมกัน',
        )
      }
      await tx.claim.update({
        where: { id: claimId },
        data: {
          state: action === 'withdraw' ? 'WITHDRAWN' : 'MISSED',
          deadline: null,
          reason:
            action === 'withdraw'
              ? 'ผู้ขอรับสละสิทธิ์'
              : 'เจ้าของยืนยันว่าผิดนัดหลังสิ้นสุดช่วงนัดรับ',
        },
      })
      await advanceQueue(tx, item, now)
    }
  })
  res.sendStatus(204)
})
