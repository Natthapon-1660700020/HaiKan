import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { db } from './db.js'
import { ensure } from './errors.js'
const derive = promisify(scrypt)
const publicUser = { id: true, name: true, role: true } as const
const credentials = z.object({
  email: z.email().max(200).toLowerCase(),
  password: z.string().min(8).max(128),
})
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const digest = (await derive(password, salt, 64)) as Buffer
  return salt + '.' + digest.toString('hex')
}
function sessionHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}
function readToken(req: Request) {
  return /(?:^|;\s*)haikan_session=([0-9a-f]{64})(?:;|$)/.exec(
    req.headers.cookie ?? '',
  )?.[1]
}
export async function viewer(req: Request) {
  const token = readToken(req)
  if (!token) return null
  const session = await db.session.findUnique({
    where: { tokenHash: sessionHash(token) },
    include: { user: { select: publicUser } },
  })
  return session && session.expires > new Date() ? session.user : null
}
export async function member(req: Request) {
  const user = await viewer(req)
  ensure(user, 401, 'กรุณาเข้าสู่ระบบ')
  return user
}
async function signIn(
  res: Response,
  user: { id: string; name: string; role: string },
) {
  const token = randomBytes(32).toString('hex')
  const duration = 7 * 86400000
  await db.session.create({
    data: {
      tokenHash: sessionHash(token),
      userId: user.id,
      expires: new Date(Date.now() + duration),
    },
  })
  res.cookie('haikan_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: duration,
    path: '/',
  })
  res.json({ user: { id: user.id, name: user.name, role: user.role } })
}
export const auth = Router()
auth.get('/me', async (req, res) => {
  res.json({ user: await viewer(req) })
})
auth.post('/register', async (req, res) => {
  const input = credentials
    .extend({ name: z.string().trim().min(1).max(80) })
    .parse(req.body)
  const user = await db.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
    },
    select: publicUser,
  })
  res.status(201)
  await signIn(res, user)
})
auth.post('/login', async (req, res) => {
  const input = credentials.parse(req.body)
  const user = await db.user.findUnique({ where: { email: input.email } })
  const [salt, digest] = (
    user?.passwordHash ?? 'missing.' + '00'.repeat(64)
  ).split('.')
  const actual = (await derive(input.password, salt, 64)) as Buffer
  ensure(
    user && timingSafeEqual(actual, Buffer.from(digest, 'hex')),
    401,
    'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  )
  await signIn(res, user)
})
auth.post('/logout', async (req, res) => {
  const token = readToken(req)
  if (token)
    await db.session.deleteMany({ where: { tokenHash: sessionHash(token) } })
  res.clearCookie('haikan_session', { path: '/' }).sendStatus(204)
})
