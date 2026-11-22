import { Prisma, type Item } from '@prisma/client'

import { db } from './db.js'
import { ensure } from './errors.js'

export type Transaction = Prisma.TransactionClient
export const activeStates = [
  'CONFIRMED',
  'RESCHEDULE',
  'OFFERED',
  'WAITING',
] as const
export const holderStates = ['CONFIRMED', 'RESCHEDULE', 'OFFERED'] as const
export const hour = 3600000
export const openWindow = (item: Item, now: Date) =>
  !item.needsWindow && (!item.endsAt || item.endsAt > now)
export async function withItem<T>(
  id: string,
  run: (tx: Transaction, item: Item, now: Date) => Promise<T>,
) {
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Item" WHERE id = ${id} FOR UPDATE`
      const item = await tx.item.findUnique({ where: { id } })
      ensure(item, 404, 'ประกาศนี้เปิดดูไม่ได้')
      const now = new Date()
      return run(tx, item, now)
    },
    { maxWait: 10000, timeout: 15000 },
  )
}
export async function reserve(id: string, userId: string) {
  return withItem(id, async (tx, item, now) => {
    ensure(
      !item.hiddenAt &&
        ['OPEN', 'RESERVED'].includes(item.state) &&
        openWindow(item, now),
      409,
      'ประกาศยังไม่เปิดให้ขอรับ',
    )
    ensure(item.ownerId !== userId, 403, 'เจ้าของขอรับประกาศของตนเองไม่ได้')
    await advanceQueue(tx, item, now)
    const holder = await tx.claim.findFirst({
      where: { itemId: id, state: { in: [...holderStates] } },
    })
    const claim = await tx.claim.create({
      data: {
        itemId: id,
        userId,
        state: holder ? 'WAITING' : 'CONFIRMED',
        deadline:
          !holder && !item.endsAt ? new Date(now.getTime() + 48 * hour) : null,
      },
    })
    await tx.item.update({ where: { id }, data: { state: 'RESERVED' } })
    return claim
  })
}

export function offerDeadline(now: Date, end: Date | null) {
  return new Date(
    Math.min(now.getTime() + 2 * hour, end?.getTime() ?? Infinity),
  )
}
export async function advanceQueue(tx: Transaction, item: Item, now: Date) {
  if (item.hiddenAt || item.state === 'CLOSED' || item.state === 'GIVEN') return
  const holder = await tx.claim.findFirst({
    where: { itemId: item.id, state: { in: [...holderStates] } },
  })
  if (holder) {
    if (!holder.deadline || holder.deadline > now) return
    const pause =
      holder.state !== 'CONFIRMED' &&
      item.endsAt &&
      item.endsAt <= holder.deadline
    await tx.claim.update({
      where: { id: holder.id },
      data: {
        state: pause ? 'WAITING' : 'EXPIRED',
        deadline: null,
        reason: pause
          ? 'หมดช่วงนัดรับ พักคิวเดิมจนกว่าจะมีช่วงใหม่'
          : holder.state === 'CONFIRMED'
            ? 'ตกลงนัดไม่ทันภายใน 48 ชั่วโมง'
            : 'หมดเวลายืนยันสิทธิ์',
      },
    })
  }
  const next = openWindow(item, now)
    ? await tx.claim.findFirst({
        where: { itemId: item.id, state: 'WAITING' },
        orderBy: { id: 'asc' },
      })
    : null
  if (next)
    await tx.claim.update({
      where: { id: next.id },
      data: {
        state: 'OFFERED',
        deadline: offerDeadline(now, item.endsAt),
        reason: 'ถึงลำดับของคุณแล้ว กรุณายืนยันสิทธิ์',
      },
    })
  const state = next ? 'RESERVED' : 'OPEN'
  if (item.state !== state)
    await tx.item.update({ where: { id: item.id }, data: { state } })
}
export async function reconcileDue() {
  const due = await db.claim.findMany({
    where: {
      deadline: { lte: new Date() },
      state: { in: [...holderStates] },
      item: { hiddenAt: null, state: 'RESERVED' },
    },
    select: { itemId: true },
    take: 100,
    orderBy: { deadline: 'asc' },
  })
  for (const { itemId } of due) await withItem(itemId, advanceQueue)
}
