import type { CustomValues, FieldDef, FieldScope, FieldType, FieldValue } from './types'

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Text',
  textarea: 'Mehrzeiliger Text',
  number: 'Zahl',
  money: 'Betrag',
  date: 'Datum',
  select: 'Auswahl',
  boolean: 'Ja/Nein',
  image: 'Bild',
}

export const RESERVED_KEYS: Record<FieldScope, string[]> = {
  org: ['name', 'street', 'zip', 'city', 'country', 'logo', 'vat_id', 'tax_number', 'iban', 'bic', 'bank_name', 'email', 'phone', 'website', 'small_business'],
  customer: ['number', 'name', 'street', 'zip', 'city', 'country', 'email', 'vat_id', 'tax_treatment'],
  contact: ['salutation', 'first_name', 'last_name', 'full_name', 'position', 'email', 'phone'],
  catalog: ['title', 'description', 'category', 'unit', 'price', 'tax_rate'],
  document: ['type', 'type_label', 'status', 'number', 'date', 'due_date', 'valid_until', 'service_date', 'service_date_end', 'intro', 'closing', 'net_total', 'tax_total', 'gross_total', 'optional_total', 'tax_breakdown', 'legal_notes', 'source_number', 'customer', 'contact', 'positions'],
  position: ['index', 'kind', 'is_item', 'is_heading', 'is_text', 'is_optional', 'title', 'description', 'quantity', 'unit', 'unit_name', 'unit_code', 'unit_price', 'tax_percent', 'category', 'total'],
}

const KEY_RE = /^[a-z][a-z0-9_]*$/
const TRANSLIT: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }

export function slugifyKey(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => TRANSLIT[c])
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!base) return ''
  return /^[a-z]/.test(base) ? base : `f_${base}`
}

export function validateFieldDef(
  def: Pick<FieldDef, 'id' | 'key' | 'label' | 'type' | 'options'>,
  existing: FieldDef[],
  scope: FieldScope,
): string[] {
  const errors: string[] = []
  if (!def.label.trim()) errors.push('Bezeichnung fehlt.')
  if (!KEY_RE.test(def.key)) errors.push('Schlüssel darf nur Kleinbuchstaben, Ziffern und _ enthalten und muss mit einem Buchstaben beginnen.')
  if (RESERVED_KEYS[scope].includes(def.key)) errors.push(`„${def.key}“ ist ein Kernfeld und reserviert.`)
  if (existing.some((f) => f.key === def.key && f.id !== def.id)) errors.push(`Schlüssel „${def.key}“ ist bereits vergeben.`)
  if (def.type === 'select' && def.options.filter((o) => o.trim()).length === 0) errors.push('Auswahlfelder brauchen mindestens eine Option.')
  return errors
}

export const isEmptyValue = (v: FieldValue | undefined): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

export const defaultCustomValues = (defs: FieldDef[]): CustomValues =>
  Object.fromEntries(defs.map((d) => [d.key, d.defaultValue]))
