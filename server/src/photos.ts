import { randomUUID } from 'node:crypto'
import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import sharp from 'sharp'
import { z } from 'zod'
import { viewer } from './auth.js'
import { db } from './db.js'
import { ApiError, ensure } from './errors.js'
import { itemInput } from './validation.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 1,
    fieldSize: 32 * 1024,
  },
}).single('photo')

// Existing JSON clients and the form without a new photo use the same validator.
export async function readItemForm(req: Request, res: Response) {
  if (!req.is('multipart/form-data'))
    return { data: itemInput.parse(req.body), photo: null }
  await new Promise<void>((resolve, reject) => {
    upload(req, res, (error: unknown) => {
      if (!error) return resolve()
      if (
        error instanceof multer.MulterError &&
        error.code === 'LIMIT_FILE_SIZE'
      ) {
        return reject(new ApiError(413, 'กรุณาเลือกรูปขนาดไม่เกิน 5 MB'))
      }
      reject(new ApiError(400, 'อัปโหลดรูปไม่สำเร็จ กรุณาเลือกไฟล์อีกครั้ง'))
    })
  })
  const fields = z.string().parse(req.body.item)
  const data = itemInput.parse(JSON.parse(fields))
  ensure(req.file, 422, 'กรุณาเลือกไฟล์รูปภาพ')
  try {
    const image = sharp(req.file.buffer, { limitInputPixels: 48_000_000 })
    const { format } = await image.metadata()
    ensure(
      ['jpeg', 'png', 'webp'].includes(format),
      415,
      'รองรับรูป JPG, PNG และ WebP',
    )
    const bytes = await image
      .rotate()
      .resize({
        width: 1440,
        height: 1440,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer()
    return { data, photo: { id: randomUUID(), content: new Uint8Array(bytes) } }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      422,
      'อ่านรูปไม่ได้ กรุณาเลือกรูป JPG, PNG หรือ WebP ที่เปิดดูได้และไม่เกิน 48 ล้านพิกเซล',
    )
  }
}

export const photos = Router()
photos.get('/photos/:id', async (req, res) => {
  const id = z.uuid().safeParse(req.params.id)
  ensure(id.success, 404, 'ไม่พบรูปภาพ')
  const user = await viewer(req)
  const photo = await db.itemPhoto.findFirst({
    where: {
      id: id.data,
      item: {
        OR: [{ hiddenAt: null, archivedAt: null }, ...(user ? [
          { ownerId: user.id },
          { hiddenAt: null, claims: { some: { userId: user.id } } },
        ] : [])],
      },
    },
    select: { content: true },
  })
  ensure(photo, 404, 'ไม่พบรูปภาพ')
  res
    .type('image/webp')
    .set('X-Content-Type-Options', 'nosniff')
    .send(Buffer.from(photo.content))
})
