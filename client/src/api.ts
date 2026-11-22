import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  Area,
  Detail,
  Filters,
  Item,
  ItemPage,
  MyClaim,
  User,
} from './model'
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}
export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const multipart = body instanceof FormData
  const response = await fetch('/api' + path, {
    method,
    signal,
    credentials: 'same-origin',
    headers: body && !multipart ? { 'Content-Type': 'application/json' } : {},
    body: multipart ? body : body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    const data: { message?: string } = await response.json().catch(() => ({}))
    throw new HttpError(response.status, data.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>)
}
export const useUser = () =>
  useQuery({
    queryKey: ['me'],
    queryFn: () => api<{ user: User | null }>('/auth/me'),
  })
export const useAreas = () =>
  useQuery({ queryKey: ['areas'], queryFn: () => api<Area[]>('/areas') })
export function useItems(filters: Filters, page: number) {
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value),
  )
  params.set('page', String(page))
  return useQuery({
    queryKey: ['items', filters, page],
    queryFn: ({ signal }) =>
      api<ItemPage>('/items?' + params, 'GET', undefined, signal),
  })
}
export const useDetail = (id: string) =>
  useQuery({
    queryKey: ['item', id],
    queryFn: () => api<Detail>('/items/' + id),
    enabled: !!id,
  })
export const useMine = () =>
  useQuery({ queryKey: ['mine'], queryFn: () => api<Item[]>('/mine') })
export const useClaims = () =>
  useQuery({ queryKey: ['claims'], queryFn: () => api<MyClaim[]>('/claims') })
export function useAction<T = unknown>() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      path,
      method = 'POST',
      body,
    }: {
      path: string
      method?: string
      body?: unknown
    }) => api<T>(path, method, body),
    onSuccess: async (result, { path, method }) => {
      if (method === 'DELETE' && path.startsWith('/items/')) {
        const id = path.split('/')[2]
        const isDeletedDetail = (key: readonly unknown[]) =>
          (key[0] === 'item' || key[0] === 'history') && key[1] === id
        await queryClient.invalidateQueries({
          predicate: (q) => isDeletedDetail(q.queryKey),
          refetchType: 'none',
        })
        await queryClient.invalidateQueries({
          predicate: (q) => !isDeletedDetail(q.queryKey),
        })
        return
      }
      if (path.startsWith('/auth/')) {
        await queryClient.cancelQueries()
        queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
        queryClient.setQueryData(['me'], result ?? { user: null })
      }
      await queryClient.invalidateQueries()
    },
  })
}
