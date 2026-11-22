import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
for (const [name, label, port] of [
  ['DATABASE_URL', 'runtime', '6543'],
  ['DIRECT_URL', 'migration', '5432'],
]) {
  const value = process.env[name]
  if (!value || /DB_PASSWORD|PROJECT_REF|POOLER_HOST/.test(value)) {
    console.info(label, port, 'รอการตั้งค่า', name)
    process.exitCode = 1
    continue
  }
  const prisma = new PrismaClient({ datasourceUrl: value })
  try {
    await prisma.$queryRaw`SELECT 1`
    console.info(label, port, 'เชื่อมต่อสำเร็จ')
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const code = /\bP10\d\d\b/.exec(message)?.[0] || ''
    const cause = /authentication|P1000/i.test(message)
      ? 'ตรวจบัญชีหรือรหัสผ่าน'
      : /TLS|certificate|SSL/i.test(message)
        ? 'ตรวจการตั้งค่า TLS'
        : /reach|timeout|P1001/i.test(message)
          ? 'ติดต่อปลายทางไม่ได้'
          : 'ตรวจ URL และการเข้าถึงฐานข้อมูล'
    console.error(label, port, code, cause)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}
