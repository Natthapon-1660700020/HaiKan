import { create } from 'zustand'
import { persist } from 'zustand/middleware'
type SavedStore = { ids: string[]; toggle: (id: string) => void }
export const useSaved = create<SavedStore>()(
  persist(
    (set) => ({
      ids: [],
      toggle: (id) =>
        set((s) => ({
          ids: s.ids.includes(id)
            ? s.ids.filter((x) => x !== id)
            : [id, ...s.ids],
        })),
    }),
    { name: 'haikan-saved', partialize: ({ ids }) => ({ ids }) },
  ),
)
