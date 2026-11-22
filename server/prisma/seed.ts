import { db } from '../src/db.js'
import { hashPassword } from '../src/auth.js'
const samples = [
  ['โคมไฟอ่านหนังสือตั้งโต๊ะ', 'desk-lamp', 'ของใช้ในบ้าน', 'สภาพดีมาก'],
  ['หนังสืออ่านเล่น ชุดวันพักผ่อน', 'novels', 'หนังสือ', 'สภาพดี'],
  ['เสื้อแจ็กเก็ตยีนส์ ทรงคลาสสิก', 'denim-jacket', 'เสื้อผ้า', 'สภาพดี'],
  ['ชุดดินสอสีสำหรับวาดภาพ', 'colored-pencils', 'อุปกรณ์การเรียน', 'เหมือนใหม่'],
  ['แก้วเซรามิกคู่สีธรรมชาติ', 'ceramic-mugs', 'ของใช้ในบ้าน', 'สภาพดีมาก'],
  ['หนังสือเตรียมสอบและสรุปบทเรียน', 'study-books', 'หนังสือ', 'สภาพดี'],
  ['กระเป๋าผ้าสำหรับใส่หนังสือ', 'tote-bag', 'เสื้อผ้า', 'เหมือนใหม่'],
  ['สมุดจดปกสีพาสเทล', 'notebooks', 'อุปกรณ์การเรียน', 'เหมือนใหม่'],
  ['กระถางต้นไม้สำหรับมุมทำงาน', 'plant-pot', 'ของใช้ในบ้าน', 'สภาพดี'],
  ['หนังสือภาพสำหรับเด็ก', 'picture-books', 'หนังสือ', 'สภาพดีมาก'],
  ['เสื้อยืดผ้าฝ้ายใส่สบาย', 'tshirt', 'เสื้อผ้า', 'สภาพดี'],
  ['กระเป๋าดินสอพร้อมใช้', 'pencil-case', 'อุปกรณ์การเรียน', 'สภาพดีมาก'],
]
const areas = [
  ['กรุงเทพมหานคร', 'จตุจักร'],
  ['นนทบุรี', 'เมืองนนทบุรี'],
  ['เชียงใหม่', 'เมืองเชียงใหม่'],
  ['กรุงเทพมหานคร', 'บางเขน'],
  ['ปทุมธานี', 'คลองหลวง'],
  ['ขอนแก่น', 'เมืองขอนแก่น'],
  ['เชียงใหม่', 'สันทราย'],
]
async function seed() {
  const passwordHash = await hashPassword('HaiKanDemo123')
  const users: { id: string }[] = []
  for (const [key, name] of [
    ['giver', 'คุณใบชา'],
    ['receiver', 'คุณข้าวหอม'],
    ['admin', 'ผู้ดูแลให้กัน'],
  ]) {
    users.push(
      await db.user.upsert({
        where: { email: key + '@haikan.example' },
        update: {},
        create: {
          email: key + '@haikan.example',
          name,
          passwordHash,
          role: key === 'admin' ? 'ADMIN' : 'MEMBER',
        },
      }),
    )
  }
  for (let index = 0; index < 48; index++) {
    const [title, asset, category, condition] = samples[index % samples.length]
    const [province, district] = areas[index % areas.length]
    const id = 'demo-' + String(index + 1).padStart(3, '0')
    const state =
      index % 12 === 5
        ? 'GIVEN'
        : index % 12 === 9
          ? 'CLOSED'
          : index % 12 === 2
            ? 'RESERVED'
            : 'OPEN'
    await db.$transaction(async (tx) => {
      if (await tx.item.findUnique({ where: { id } })) return
      const start = new Date(
        Date.now() + (index % 12 === 8 ? -4 : 1) * 86400000,
      )
      await tx.item.create({
        data: {
          id,
          title:
            title +
            ['', ' จากบ้านสวน', ' สำหรับใช้ต่อ', ' แบ่งปันให้เพื่อนบ้าน'][
              Math.floor(index / 12)
            ],
          image: '/images/' + asset + '.webp',
          category,
          condition,
          description:
            'ใช้งานได้ดี เจ้าของเดิมดูแลรักษาไว้และอยากส่งต่อให้เพื่อนบ้านที่ต้องการ กรุณาตรวจสอบรายละเอียดและช่วงเวลานัดรับก่อนขอรับ',
          contents: index % 12 === 3 ? 'ดินสอสี 12 แท่งพร้อมกล่อง' : null,
          province,
          district,
          community: 'ชุมชนสวนร่มรื่น',
          pickupPoint: 'โต๊ะประชาสัมพันธ์อาคารตัวอย่าง',
          contact: 'LINE: haikan_demo',
          ownerId: users[0].id,
          state,
          startsAt: index % 4 === 0 && index % 12 !== 8 ? null : start,
          endsAt:
            index % 4 === 0 && index % 12 !== 8
              ? null
              : new Date(start.getTime() + 86400000),
          createdAt: new Date(Date.now() - index * 3600000),
          reason: state === 'CLOSED' ? 'เจ้าของปิดการส่งต่อแล้ว' : null,
        },
      })
      if (state === 'RESERVED' || state === 'GIVEN')
        await tx.claim.create({
          data: {
            itemId: id,
            userId: users[1].id,
            state: state === 'GIVEN' ? 'COMPLETED' : 'CONFIRMED',
          },
        })
    })
  }
  console.info('ตรวจและเตรียมประกาศตัวอย่าง 48 รายการแล้ว')
}
seed()
  .catch(() => {
    console.error('Seed ไม่สำเร็จ ตรวจ DATABASE_URL ฝั่ง runtime')
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
