import { z } from 'zod'
export const categories = [
  'หนังสือ',
  'เสื้อผ้า',
  'อุปกรณ์การเรียน',
  'ของใช้ในบ้าน',
] as const
const required = (max: number) => z.string().trim().min(1).max(max)
export const windowFields = {
  startsAt: z.iso.datetime().nullable(),
  endsAt: z.iso.datetime().nullable(),
}
export function validWindow(value: {
  startsAt: string | null
  endsAt: string | null
}) {
  if (!value.startsAt || !value.endsAt) return value.startsAt === value.endsAt
  return (
    Date.parse(value.endsAt) > Math.max(Date.parse(value.startsAt), Date.now())
  )
}
export const itemInput = z
  .object({
    title: required(140),
    category: z.enum(categories),
    condition: required(80),
    image: required(2200)
      .refine(
        (s) =>
          (/^https?:\/\//i.test(s) && URL.canParse(s)) ||
          /^\/images\/[\w-]+\.webp$/.test(s),
      )
      .optional(),
    description: required(2500),
    contents: required(1800).nullable(),
    province: required(90),
    district: required(90),
    community: z.string().trim().max(120),
    pickupPoint: required(400),
    contact: required(160),
    ...windowFields,
    rights: z.literal(true),
  })
  .refine(
    (v) =>
      Boolean(v.startsAt) === Boolean(v.endsAt) &&
      (!v.startsAt || Date.parse(v.endsAt!) > Date.parse(v.startsAt)),
  )
export const reasonInput = z.object({ reason: required(500) })
export const newWindow = z
  .object({
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    reason: required(500),
  })
  .refine(validWindow)
