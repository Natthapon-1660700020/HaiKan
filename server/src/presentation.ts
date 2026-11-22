import { type Item, type Claim } from '@prisma/client'
export const publicFields = {
  id: true,
  title: true,
  image: true,
  category: true,
  condition: true,
  description: true,
  contents: true,
  province: true,
  district: true,
  community: true,
  startsAt: true,
  endsAt: true,
  state: true,
  ownerId: true,
  createdAt: true,
  needsWindow: true,
  owner: { select: { name: true } },
} as const
export function pickupDetails(
  item: Item,
  userId: string | undefined,
  claim: Claim | null,
) {
  const permitted =
    userId === item.ownerId ||
    (!item.hiddenAt &&
      claim &&
      ['CONFIRMED', 'COMPLETED'].includes(claim.state))
  return permitted
    ? { pickupPoint: item.pickupPoint, contact: item.contact }
    : null
}
