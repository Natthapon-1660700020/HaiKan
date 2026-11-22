import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { db } from '../src/db.js'

// This suite moves deadlines in a disposable local database. Never run on Supabase.
const url = new URL(process.env.DATABASE_URL || 'http://unset')
assert.equal(url.hostname, '127.0.0.1')
assert.equal(url.port, '55439')
const origin = 'http://127.0.0.1:4000/api'
async function call(
  path: string,
  method = 'GET',
  cookie = '',
  body?: unknown,
  status = 200,
) {
  const res = await fetch(origin + path, {
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  assert.equal(
    res.status,
    status,
    method + ' ' + path + ' ' + text.slice(0, 160),
  )
  return {
    data: text ? (JSON.parse(text) as unknown) : null,
    cookie: res.headers.get('set-cookie')?.split(';')[0] || '',
  }
}
const seed = randomUUID()
const ids: string[] = []
async function run() {
  const login = async (name: string) =>
    (
      await call('/auth/login', 'POST', '', {
        email: name + '@haikan.example',
        password: 'HaiKanDemo123',
      })
    ).cookie
  const [giver, receiver, admin] = await Promise.all(
    ['giver', 'receiver', 'admin'].map(login),
  )
  const people = [receiver]
  for (let n = 0; n < 3; n++)
    people.push(
      (
        await call(
          '/auth/register',
          'POST',
          '',
          {
            email: 'test-' + seed + '-' + n + '@haikan.example',
            password: 'HaiKanTest123',
            name: 'สมาชิกทดสอบ ' + n,
          },
          201,
        )
      ).cookie,
    )
  const data = {
    title: 'ทดสอบคิว ' + seed,
    category: 'หนังสือ',
    condition: 'สภาพดี',
    description: 'ชุดหนังสือสำหรับทดสอบ',
    contents: 'หนังสือสองเล่ม',
    province: 'เชียงใหม่',
    district: 'สันทราย',
    community: '',
    image: '/images/study-books.webp',
    rights: true,
    pickupPoint: 'private point',
    contact: 'private line',
    startsAt: null,
    endsAt: null,
  }
  async function create() {
    const { id } = (await call('/items', 'POST', giver, data, 201)).data as {
      id: string
    }
    assert.ok(
      await db.item.findUnique({ where: { id } }),
      'API must use the same test DB',
    )
    ids.push(id)
    return id
  }
  const claim = async (id: string, cookie: string, status = 201) =>
    (
      await call(
        '/items/' + id + '/claims',
        'POST',
        cookie,
        { acceptsPickup: true },
        status,
      )
    ).data as { id: number; state: string; deadline: string | null }
  const act = async (
    id: string,
    claimId: number,
    cookie: string,
    action: string,
    status = 204,
  ) =>
    call(
      '/items/' + id + '/claims/' + claimId,
      'PATCH',
      cookie,
      { action },
      status,
    )
  const snapshot = async (id: string) =>
    db.claim.findMany({ where: { itemId: id }, orderBy: { id: 'asc' } })
  const id = await create()
  const tests = await Promise.all(
    people.slice(0, 2).map((cookie) => claim(id, cookie)),
  )
  const first = tests.findIndex((c) => c.state === 'CONFIRMED'),
    second = 1 - first
  assert.equal(tests[second].state, 'WAITING')
  assert.ok(
    Math.abs(Date.parse(tests[first].deadline!) - Date.now() - 48 * 3600000) <
      30000,
  )
  await claim(id, people[first], 409)
  await claim(id, giver, 403)
  await claim(id, people[2])
  await claim(id, people[3])
  await act(id, tests[first].id, giver, 'missed', 409)
  await act(id, tests[first].id, people[first], 'withdraw')
  let rows = await snapshot(id)
  assert.deepEqual(
    rows.map((c) => c.state),
    ['WITHDRAWN', 'OFFERED', 'WAITING', 'WAITING'],
  )
  assert.ok(
    Math.abs(rows[1].deadline!.getTime() - Date.now() - 7200000) < 30000,
  )
  assert.equal(
    (
      (await call('/items/' + id, 'GET', people[second])).data as {
        pickup: unknown
      }
    ).pickup,
    null,
  )
  await db.claim.update({
    where: { id: rows[1].id },
    data: { deadline: new Date(Date.now() - 1000) },
  })
  // Read only the database here so the server timer must advance the queue on its own.
  const timeout = Date.now() + 22000
  do {
    await new Promise((resolve) => setTimeout(resolve, 500))
    rows = await snapshot(id)
  } while (rows[2].state !== 'OFFERED' && Date.now() < timeout)
  assert.deepEqual(
    rows.map((c) => c.state),
    ['WITHDRAWN', 'EXPIRED', 'OFFERED', 'WAITING'],
  )
  await act(id, rows[2].id, people[2], 'withdraw')
  rows = await snapshot(id)
  assert.equal(rows[3].state, 'OFFERED')
  await act(id, rows[3].id, people[3], 'accept')
  await db.claim.update({
    where: { id: rows[3].id },
    data: { deadline: new Date(Date.now() - 1000) },
  })
  await call('/claims', 'GET', people[3])
  assert.equal((await snapshot(id))[3].state, 'EXPIRED')
  assert.equal(
    (await db.item.findUniqueOrThrow({ where: { id } })).state,
    'OPEN',
  )
  await call('/items/' + id, 'DELETE', giver, undefined, 409)
  await call(
    '/items/' + id + '/close',
    'PATCH',
    giver,
    { reason: 'งดการส่งต่อ' },
    204,
  )
  assert.equal((await snapshot(id)).length, 4)
  console.log(
    'PASS simultaneous requests, duplicate, privacy, 2h offer, queue 3 and 4, 48h expiry, close with history',
  )

  const reschedule = await create()
  const winner = await claim(reschedule, receiver)
  await claim(reschedule, people[1])
  const window = {
    startsAt: new Date(Date.now() + 600000).toISOString(),
    endsAt: new Date(Date.now() + 3600000).toISOString(),
    reason: 'เจ้าของเสนอช่วงรับ',
  }
  await call('/items/' + reschedule + '/window', 'PATCH', giver, window, 204)
  assert.equal((await snapshot(reschedule))[0].state, 'RESCHEDULE')
  await act(reschedule, winner.id, receiver, 'accept')
  await call(
    '/items/' + reschedule + '/report',
    'POST',
    people[1],
    { reason: 'ตรวจข้อมูลประกาศ' },
    201,
  )
  await call(
    '/items/' + reschedule + '/report',
    'POST',
    people[1],
    { reason: 'รายงานอีกครั้ง' },
    409,
  )
  await call('/admin/reports', 'GET', receiver, undefined, 403)
  await call(
    '/admin/items/' + reschedule,
    'PATCH',
    admin,
    { action: 'hide', reason: 'รอตรวจข้อมูล' },
    204,
  )
  assert.equal((await call('/saved/' + reschedule)).data, null)
  await claim(reschedule, people[2], 409)
  assert.ok(
    !JSON.stringify((await call('/claims', 'GET', receiver)).data).includes(
      'private line',
    ),
  )
  await db.item.update({
    where: { id: reschedule },
    data: {
      startsAt: new Date(Date.now() - 7200000),
      endsAt: new Date(Date.now() - 3600000),
    },
  })
  await call(
    '/admin/items/' + reschedule,
    'PATCH',
    admin,
    { action: 'restore', reason: 'ตรวจแล้ว' },
    204,
  )
  assert.equal((await snapshot(reschedule))[0].state, 'RESCHEDULE')
  await act(reschedule, winner.id, receiver, 'accept', 409)
  await call('/items/' + reschedule + '/window', 'PATCH', giver, window, 204)
  await act(reschedule, winner.id, receiver, 'accept')
  await act(reschedule, winner.id, giver, 'complete')
  assert.equal(
    ((await call('/saved/' + reschedule)).data as { state: string }).state,
    'GIVEN',
  )
  await act(reschedule, winner.id, receiver, 'withdraw', 409)
  console.log(
    'PASS mutual appointment, hidden saved entry, suspended rights, restore after ended window, handoff finality',
  )

  const paused = await create()
  await call('/items/' + paused + '/window', 'PATCH', giver, window, 204)
  const primary = await claim(paused, receiver),
    backup = await claim(paused, people[1])
  await claim(paused, people[2])
  await act(paused, primary.id, receiver, 'withdraw')
  assert.equal(
    (await snapshot(paused))[1].deadline!.toISOString(),
    window.endsAt,
  )
  const past = new Date(Date.now() - 1000)
  await db.item.update({
    where: { id: paused },
    data: { startsAt: new Date(Date.now() - 60000), endsAt: past },
  })
  await db.claim.update({ where: { id: backup.id }, data: { deadline: past } })
  await call('/claims', 'GET', people[1])
  assert.deepEqual(
    (await snapshot(paused)).map((c) => c.state),
    ['WITHDRAWN', 'WAITING', 'WAITING'],
  )
  await call('/items/' + paused + '/window', 'PATCH', giver, window, 204)
  assert.equal((await snapshot(paused))[1].state, 'OFFERED')
  await act(paused, backup.id, people[1], 'accept')
  await db.item.update({
    where: { id: paused },
    data: { startsAt: new Date(Date.now() - 60000), endsAt: past },
  })
  await act(paused, backup.id, giver, 'missed')
  assert.deepEqual(
    (await snapshot(paused)).map((c) => c.state),
    ['WITHDRAWN', 'MISSED', 'WAITING'],
  )
  console.log(
    'PASS earliest deadline, pause/reopen in original order, no-show after agreed window',
  )
}
try {
  await run()
} finally {
  for (const id of ids) {
    await db.claim.deleteMany({ where: { itemId: id } })
    await db.item.delete({ where: { id } })
  }
  await db.user.deleteMany({
    where: { email: { startsWith: 'test-' + seed + '-' } },
  })
  await db.$disconnect()
}
