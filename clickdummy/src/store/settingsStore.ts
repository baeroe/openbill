import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { seed } from '@/data/seed'
import { isoToDate } from '@/domain/dates'
import { validateFieldDef } from '@/domain/fields'
import { allocateNumber as allocate } from '@/domain/numbering'
import type { Category, DocType, DocTypeConfig, FieldDef, Organization, TaxRate, TextBlock, Unit, User } from '@/domain/types'
import { upsert, without } from './listUtils'

export interface SettingsData {
  org: Organization
  docTypes: Record<DocType, DocTypeConfig>
  taxRates: TaxRate[]
  units: Unit[]
  categories: Category[]
  textBlocks: TextBlock[]
  users: User[]
  fieldDefs: Record<'org' | 'customer' | 'contact' | 'catalog', FieldDef[]>
}
export type FieldTarget = { scope: 'org' | 'customer' | 'contact' | 'catalog' } | { scope: 'document' | 'position'; docType: DocType }

interface SettingsActions {
  updateOrg(patch: Partial<Organization>): void
  updateDocType(type: DocType, patch: Partial<DocTypeConfig>): void
  upsertFieldDef(target: FieldTarget, def: FieldDef): string[]
  removeFieldDef(target: FieldTarget, id: string): void
  moveFieldDef(target: FieldTarget, from: number, to: number): void
  allocateNumber(type: DocType, date: string): string
  upsertTaxRate(r: TaxRate): void
  removeTaxRate(id: string): void
  upsertUnit(u: Unit): void
  removeUnit(id: string): void
  upsertCategory(c: Category): void
  removeCategory(id: string): void
  upsertTextBlock(b: TextBlock): void
  removeTextBlock(id: string): void
  upsertUser(u: User): void
  removeUser(id: string): void
}

export const getFieldDefs = (s: SettingsData, t: FieldTarget): FieldDef[] =>
  t.scope === 'document' ? s.docTypes[t.docType].documentFields
  : t.scope === 'position' ? s.docTypes[t.docType].positionFields
  : s.fieldDefs[t.scope]

export const useSettingsStore = create<SettingsData & SettingsActions>()(
  persist(
    (set, get) => {
      const setDefs = (t: FieldTarget, defs: FieldDef[]) => {
        if (t.scope === 'document' || t.scope === 'position') {
          const key = t.scope === 'document' ? 'documentFields' : 'positionFields'
          set((s) => ({ docTypes: { ...s.docTypes, [t.docType]: { ...s.docTypes[t.docType], [key]: defs } } }))
        } else {
          set((s) => ({ fieldDefs: { ...s.fieldDefs, [t.scope]: defs } }))
        }
      }
      return {
        ...seed().settings,
        updateOrg: (patch) => set((s) => ({ org: { ...s.org, ...patch } })),
        updateDocType: (type, patch) => set((s) => ({ docTypes: { ...s.docTypes, [type]: { ...s.docTypes[type], ...patch } } })),
        upsertFieldDef: (target, def) => {
          const defs = getFieldDefs(get(), target)
          const errors = validateFieldDef(def, defs, target.scope)
          if (errors.length === 0) setDefs(target, upsert(defs, def))
          return errors
        },
        removeFieldDef: (target, id) => setDefs(target, without(getFieldDefs(get(), target), id)),
        moveFieldDef: (target, from, to) => {
          const defs = [...getFieldDefs(get(), target)]
          const [moved] = defs.splice(from, 1)
          defs.splice(to, 0, moved)
          setDefs(target, defs)
        },
        allocateNumber: (type, date) => {
          const { number, next } = allocate(get().docTypes[type].numbering, isoToDate(date))
          set((s) => ({ docTypes: { ...s.docTypes, [type]: { ...s.docTypes[type], numbering: next } } }))
          return number
        },
        upsertTaxRate: (r) => set((s) => ({ taxRates: upsert(s.taxRates, r) })),
        removeTaxRate: (id) => set((s) => ({ taxRates: without(s.taxRates, id) })),
        upsertUnit: (u) => set((s) => ({ units: upsert(s.units, u) })),
        removeUnit: (id) => set((s) => ({ units: without(s.units, id) })),
        upsertCategory: (c) => set((s) => ({ categories: upsert(s.categories, c) })),
        removeCategory: (id) => set((s) => ({ categories: without(s.categories, id) })),
        upsertTextBlock: (b) => set((s) => ({ textBlocks: upsert(s.textBlocks, b) })),
        removeTextBlock: (id) => set((s) => ({ textBlocks: without(s.textBlocks, id) })),
        upsertUser: (u) => set((s) => ({ users: upsert(s.users, u) })),
        removeUser: (id) => set((s) => ({ users: without(s.users, id) })),
      }
    },
    { name: 'openbill:settings', version: 1, migrate: () => seed().settings as never },
  ),
)
