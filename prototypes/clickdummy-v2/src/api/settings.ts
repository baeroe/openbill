import { allocateNumber } from '@/domain/numbering'
import { validateFieldDef } from '@/domain/fields'
import type { DocType, DocTypeConfig, FieldDef, Organization, Settings, TaxRate, TextBlock, Unit, User } from '@/domain/types'
import { ApiError, clone, db, latency, maybeFail, newId, persist } from './db'

export async function getSettings(): Promise<Settings> {
  await latency()
  maybeFail()
  return clone(db.settings)
}

async function write<T>(fn: () => T): Promise<T> {
  await latency()
  maybeFail()
  const result = fn()
  persist()
  return clone(result)
}

export const updateOrganization = (org: Organization) => write(() => (db.settings.org = org))

export const updateDocTypeConfig = (type: DocType, patch: Partial<DocTypeConfig>) =>
  write(() => (db.settings.docTypes[type] = { ...db.settings.docTypes[type], ...patch, type }))

/** Legt ein eigenes Feld an oder ändert es. Der Schlüssel ist nach dem Anlegen fest. */
export const saveFieldDef = (def: FieldDef) =>
  write(() => {
    const existing = db.settings.fieldDefs.find((f) => f.id === def.id)
    const next = existing ? { ...def, key: existing.key, scope: existing.scope } : { ...def, id: def.id || newId('fd') }
    const errors = validateFieldDef(next, db.settings.fieldDefs)
    if (errors.length) throw new ApiError(errors[0], errors)
    db.settings.fieldDefs = existing ? db.settings.fieldDefs.map((f) => (f.id === next.id ? next : f)) : [...db.settings.fieldDefs, next]
    return next
  })

export const deleteFieldDef = (id: string) => write(() => { db.settings.fieldDefs = db.settings.fieldDefs.filter((f) => f.id !== id) })

export const reorderFieldDefs = (ids: string[]) =>
  write(() => {
    const byId = new Map(db.settings.fieldDefs.map((f) => [f.id, f]))
    const moved = ids.map((id) => byId.get(id)).filter((f): f is FieldDef => !!f)
    const rest = db.settings.fieldDefs.filter((f) => !ids.includes(f.id))
    db.settings.fieldDefs = [...rest, ...moved]
  })

type Listed = 'taxRates' | 'units' | 'textBlocks' | 'users'
type Item<K extends Listed> = Settings[K][number]

function upsert<K extends Listed>(key: K, item: Item<K>) {
  return write(() => {
    const list = db.settings[key] as Item<K>[]
    const withId = { ...item, id: item.id || newId(key) }
    ;(db.settings[key] as Item<K>[]) = list.some((x) => x.id === withId.id) ? list.map((x) => (x.id === withId.id ? withId : x)) : [...list, withId]
    return withId
  })
}
function remove(key: Listed, id: string) {
  return write(() => { (db.settings[key] as { id: string }[]) = (db.settings[key] as { id: string }[]).filter((x) => x.id !== id) })
}

export const saveTaxRate = (r: TaxRate) => upsert('taxRates', r)
export const deleteTaxRate = (id: string) => remove('taxRates', id)
export const saveUnit = (u: Unit) => upsert('units', u)
export const deleteUnit = (id: string) => remove('units', id)
export const saveTextBlock = (b: TextBlock) => upsert('textBlocks', b)
export const deleteTextBlock = (id: string) => remove('textBlocks', id)
export const inviteUser = (u: Omit<User, 'id'>) => upsert('users', { ...u, id: '' })
export const deleteUser = (id: string) => remove('users', id)

/** Intern: vergibt die nächste Nummer beim Abschließen. */
export function takeNumber(type: DocType, isoDate: string): string {
  const cfg = db.settings.docTypes[type]
  const { number, next } = allocateNumber(cfg.numbering, new Date(`${isoDate}T00:00:00`))
  db.settings.docTypes[type] = { ...cfg, numbering: next }
  return number
}
