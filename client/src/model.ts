export type State = 'OPEN' | 'RESERVED' | 'GIVEN' | 'CLOSED'
export const states: Record<State, string> = {
  OPEN: 'เปิดรับ',
  RESERVED: 'จองแล้ว',
  GIVEN: 'ส่งต่อแล้ว',
  CLOSED: 'ปิดประกาศ',
}
export const claimStates = {
  WAITING: 'อยู่ในคิวสำรอง',
  OFFERED: 'รอยืนยันสิทธิ์',
  CONFIRMED: 'ได้สิทธิ์แล้ว',
  RESCHEDULE: 'รอยืนยันนัดใหม่',
  WITHDRAWN: 'สละสิทธิ์แล้ว',
  EXPIRED: 'หมดเวลายืนยัน',
  MISSED: 'ผิดนัด',
  COMPLETED: 'รับของแล้ว',
  ENDED: 'สิ้นสุดคำขอ',
}
export type User = { id: string; name: string; role: 'MEMBER' | 'ADMIN' }
export type Area = { province: string; district: string }
export type Pickup = { pickupPoint: string; contact: string }
export type Claim = {
  id: number
  itemId: string
  state: keyof typeof claimStates
  deadline: string | null
  reason: string | null
}
export type Item = Area & {
  id: string
  title: string
  image: string
  category: string
  condition: string
  description: string
  contents: string | null
  community: string
  startsAt: string | null
  endsAt: string | null
  state: State
  ownerId: string
  owner: { name: string }
  needsWindow: boolean
  createdAt: string
  hiddenAt?: string | null
  archivedAt?: string | null
  reason?: string | null
}
export type Detail = Item & {
  pickup: Pickup | null
  claim: Claim | null
  hasHistory: boolean
}
export type MyClaim = Claim & {
  position: number | null
  pickup: Pickup | null
  item: Pick<
    Item,
    | 'id'
    | 'title'
    | 'image'
    | 'startsAt'
    | 'endsAt'
    | 'state'
    | 'hiddenAt'
    | 'needsWindow'
    | 'reason'
  >
}
export type Filters = {
  search: string
  province: string
  district: string
  category: string
  condition: string
  state: string
}
export type ItemPage = {
  rows: Item[]
  total: number
  page: number
  pages: number
}
export const categories = ['หนังสือ', 'เสื้อผ้า', 'อุปกรณ์การเรียน', 'ของใช้ในบ้าน']
export const conditions = ['เหมือนใหม่', 'สภาพดีมาก', 'สภาพดี', 'มีร่องรอยการใช้งาน']
export const sampleImages = [
  '/images/study-books.webp',
  '/images/tshirt.webp',
  '/images/notebooks.webp',
  '/images/ceramic-mugs.webp',
]
export const formatTime = (value: string) =>
  new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
export function windowText(item: {
  startsAt: string | null
  endsAt: string | null
}) {
  return item.startsAt && item.endsAt
    ? formatTime(item.startsAt) + ' – ' + formatTime(item.endsAt)
    : 'นัดรับภายหลัง'
}
export function subtitle(
  item: Pick<Item, 'needsWindow' | 'endsAt' | 'state' | 'hiddenAt'>,
) {
  if (item.hiddenAt) return 'อยู่ระหว่างตรวจสอบ'
  if (
    item.needsWindow ||
    (item.state === 'OPEN' &&
      item.endsAt &&
      Date.parse(item.endsAt) <= Date.now())
  )
    return 'หมดช่วงนัดรับ'
  return states[item.state]
}
