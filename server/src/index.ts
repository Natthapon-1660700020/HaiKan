import express, { type ErrorRequestHandler } from 'express'
import cors from 'cors'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { auth } from './auth.js'
import { items } from './items.js'
import { photos } from './photos.js'
import { ApiError } from './errors.js'
import { db } from './db.js'
import { management } from './management.js'
import { moderation } from './moderation.js'
import { reconcileDue } from './queue.js'
const app = express()
const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
app.use(cors({ origin, credentials: true }))
app.use(express.json({ limit: '32kb' }))
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    req.headers.origin &&
    req.headers.origin !== origin
  ) {
    res.status(403).json({ message: 'ต้นทางคำขอไม่ถูกต้อง' })
    return
  }
  next()
})
app.use('/api/auth', auth)
app.use('/api', photos)
app.use('/api', async (_req, _res, next) => {
  await reconcileDue()
  next()
})
app.use('/api', items, management, moderation)
let scanning = false
const timer = setInterval(async () => {
  if (scanning) return
  scanning = true
  try {
    await reconcileDue()
  } catch {
    /* Requests report connection failures. The next tick retries. */
  } finally {
    scanning = false
  }
}, 15000)
timer.unref()
app.use((_req, res) => {
  res.status(404).json({ message: 'ไม่พบเส้นทางนี้' })
})
const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ApiError) {
    res.status(error.status).json({ message: error.message })
    return
  }
  if (error instanceof ZodError) {
    res
      .status(422)
      .json({ message: 'ข้อมูลไม่ครบหรือรูปแบบไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' })
    return
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    res.status(409).json({ message: 'มีข้อมูลนี้อยู่แล้ว กรุณาตรวจสอบรายการของคุณ' })
    return
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({ message: 'รูปแบบ JSON ไม่ถูกต้อง' })
    return
  }
  res.status(503).json({ message: 'ติดต่อฐานข้อมูลไม่ได้ กรุณาลองใหม่ภายหลัง' })
}
app.use(errors)
const port = Number(process.env.PORT || 4000)
app.listen(port, (error?: Error) => {
  if (error) {
    console.error('HaiKan API เปิดพอร์ตไม่ได้', port, (error as NodeJS.ErrnoException).code)
    process.exit(1)
  }
  console.info('HaiKan API listening on port', port)
})
process.once('SIGTERM', () => {
  void db.$disconnect().finally(() => process.exit(0))
})
