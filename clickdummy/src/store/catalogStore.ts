import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { seed } from '@/data/seed'
import type { CatalogItem } from '@/domain/types'
import { upsert, without } from './listUtils'

interface CatalogState { items: CatalogItem[]; upsertItem(i: CatalogItem): void; removeItem(id: string): void }

export const useCatalogStore = create<CatalogState>()(
  persist(
    (set) => ({
      items: seed().catalog,
      upsertItem: (i) => set((s) => ({ items: upsert(s.items, i) })),
      removeItem: (id) => set((s) => ({ items: without(s.items, id) })),
    }),
    { name: 'openbill:catalog', version: 1, migrate: () => ({ items: seed().catalog }) as never, partialize: (s) => ({ items: s.items }) },
  ),
)
