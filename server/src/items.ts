import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { db } from './db.js'
import { member, viewer } from './auth.js'
import { ensure } from './errors.js'
import { publicFields, pickupDetails } from './presentation.js'
import { validWindow } from './validation.js'
import { readItemForm } from './photos.js'
import { activeStates, reserve } from './queue.js'
export const items = Router()
const filters = z.object({
  search: z.string().trim().max(140).optional(),
  province: z.string().max(90).optional(),
  district: z.string().max(90).optional(),
  category: z.string().max(80).optional(),
  condition: z.string().max(80).optional(),
  state: z.enum(['OPEN', 'RESERVED', 'GIVEN', 'CLOSED']).optional(),
  page: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int())
    .optional(),
})
const pageSize = 12
items.get('/items', async (req, res) => {
  const { search, province, district, category, condition, state, page } =
    filters.parse(req.query)
  const keyword = search
    ? {
        contains: search.replace(/[\\%_]/g, '\\$&'),
        mode: 'insensitive' as const,
      }
    : undefined
  const where = {
    hiddenAt: null,
    archivedAt: null,
    province,
    district,
    category,
    condition,
    state,
    OR: keyword
      ? [{ title: keyword }, { description: keyword }, { contents: keyword }]
      : undefined,
  } satisfies Prisma.ItemWhereInput
  const query = {
    where,
    select: publicFields,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  } satisfies Prisma.ItemFindManyArgs
  if (page === undefined) {
    res.json(await db.item.findMany(query))
    return
  }
  const result = await db.$transaction(
    async (tx) => {
      const total = await tx.item.count({ where })
      const pages = Math.max(1, Math.ceil(total / pageSize))
      const current = Math.min(page, pages)
      const rows = await tx.item.findMany({
        ...query,
        skip: (current - 1) * pageSize,
        take: pageSize,
      })
      return { rows, total, page: current, pages }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  )
  res.json(result)
})
items.get('/areas', async (_req, res) => {
  res.json(
    await db.item.findMany({
      where: { hiddenAt: null, archivedAt: null },
      distinct: ['province', 'district'],
      select: { province: true, district: true },
      orderBy: [{ province: 'asc' }, { district: 'asc' }],
    }),
  )
})
items.get('/items/:id', async (req, res) => {
  const user = await viewer(req)
  const id = req.params.id
  const item = await db.item.findUnique({
    where: { id },
    include: { owner: { select: { name: true } } },
  })
  ensure(
    item && (!item.hiddenAt || item.ownerId === user?.id),
    404,
    'ประกาศนี้เปิดดูไม่ได้',
  )
  const claim = user
    ? await db.claim.findFirst({
        where: { itemId: id, userId: user.id },
        orderBy: { id: 'desc' },
      })
    : null
  ensure(!item.archivedAt || item.ownerId === user?.id || claim, 404, 'ประกาศนี้เปิดดูไม่ได้')
  const { pickupPoint: _point, contact: _contact, ...details } = item
  res.json({
    ...details,
    pickup: pickupDetails(item, user?.id, claim),
    claim,
    hasHistory: !!(await db.claim.count({ where: { itemId: id } })),
  })
})
items.post('/items', async (req, res) => {
  const user = await member(req)
  const {
    data: { rights: _rights, ...data },
    photo,
  } = await readItemForm(req, res)
  ensure(validWindow(data), 422, 'กรุณาตรวจสอบช่วงเวลานัดรับ')
  const image = photo ? '/api/photos/' + photo.id : data.image
  ensure(image, 422, 'กรุณาเลือกรูปภาพประกาศ')
  res.status(201).json(
    await db.item.create({
      data: {
        ...data,
        image,
        ownerId: user.id,
        photo: photo ? { create: photo } : undefined,
      },
      select: { id: true },
    }),
  )
})
items.post('/items/:id/claims', async (req, res) => {
  const user = await member(req)
  z.object({ acceptsPickup: z.literal(true) }).parse(req.body)
  res.status(201).json(await reserve(req.params.id, user.id))
})
items.get('/mine', async (req, res) => {
  const user = await member(req)
  res.json(
    await db.item.findMany({
      where: { ownerId: user.id },
      select: {
        ...publicFields,
        hiddenAt: true,
        archivedAt: true,
        reason: true,
        _count: { select: { claims: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  )
})
items.get('/claims', async (req, res) => {
  const user = await member(req)
  const claims = await db.claim.findMany({
    where: { userId: user.id },
    include: { item: true },
    orderBy: { id: 'desc' },
  })
  res.json(
    await Promise.all(
      claims.map(async ({ item, ...claim }) => ({
        ...claim,
        item: {
          id: item.id,
          title: item.title,
          image: item.image,
          state: item.state,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          hiddenAt: item.hiddenAt,
          reason: item.reason,
          needsWindow: item.needsWindow,
        },
        position:
          claim.state === 'WAITING'
            ? 1 +
              (await db.claim.count({
                where: {
                  itemId: item.id,
                  state: { in: [...activeStates] },
                  id: { lt: claim.id },
                },
              }))
            : null,
        pickup: pickupDetails(item, user.id, claim),
      })),
    ),
  )
})
