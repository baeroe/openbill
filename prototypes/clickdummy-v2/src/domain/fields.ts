import type { CustomValues, DocType, FieldDef, FieldScope, FieldType, FieldValue } from './types'

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

export const SCOPE_LABELS: Record<FieldScope, string> = {
  org: 'Organisation',
  customer: 'Kunde',
  contact: 'Ansprechpartner',
  document: 'Dokument',
  position: 'Position',
}

export const SCOPE_LIQUID: Record<FieldScope, string> = {
  org: 'org',
  customer: 'customer',
  contact: 'contact',
  document: 'document',
  position: 'p',
}

/** Kernfelder je Ebene: nicht löschbar, Schlüssel reserviert. */
export const CORE_FIELDS: Record<FieldScope, { key: string; label: string }[]> = {
  org: [
    { key: 'name', label: 'Name' }, { key: 'street', label: 'Straße' }, { key: 'zip', label: 'PLZ' }, { key: 'city', label: 'Ort' },
    { key: 'country', label: 'Land' }, { key: 'logo', label: 'Logo' }, { key: 'vat_id', label: 'USt-ID' }, { key: 'tax_number', label: 'Steuernummer' },
    { key: 'iban', label: 'IBAN' }, { key: 'bic', label: 'BIC' }, { key: 'bank_name', label: 'Bank' }, { key: 'email', label: 'E-Mail' },
    { key: 'phone', label: 'Telefon' }, { key: 'website', label: 'Website' }, { key: 'small_business', label: 'Kleinunternehmer' },
  ],
  customer: [
    { key: 'number', label: 'Kundennummer' }, { key: 'name', label: 'Name' }, { key: 'street', label: 'Straße' }, { key: 'zip', label: 'PLZ' },
    { key: 'city', label: 'Ort' }, { key: 'country', label: 'Land' }, { key: 'email', label: 'E-Mail' }, { key: 'vat_id', label: 'USt-ID' },
    { key: 'tax_treatment', label: 'Steuerbehandlung' },
  ],
  contact: [
    { key: 'salutation', label: 'Anrede' }, { key: 'first_name', label: 'Vorname' }, { key: 'last_name', label: 'Nachname' },
    { key: 'full_name', label: 'Voller Name' }, { key: 'position', label: 'Position' }, { key: 'email', label: 'E-Mail' }, { key: 'phone', label: 'Telefon' },
  ],
  document: [
    { key: 'number', label: 'Nummer' }, { key: 'date', label: 'Datum' }, { key: 'type_label', label: 'Dokumenttyp' }, { key: 'status', label: 'Status' },
    { key: 'due_date', label: 'Fällig am' }, { key: 'valid_until', label: 'Gültig bis' }, { key: 'service_date', label: 'Leistungsdatum' },
    { key: 'service_date_end', label: 'Leistung bis' }, { key: 'intro', label: 'Einleitung' }, { key: 'closing', label: 'Schlusstext' },
    { key: 'net_total', label: 'Netto' }, { key: 'tax_total', label: 'Steuer' }, { key: 'gross_total', label: 'Brutto' },
    { key: 'optional_total', label: 'Optional (netto)' }, { key: 'tax_breakdown', label: 'Steueraufschlüsselung' },
    { key: 'legal_notes', label: 'Gesetzliche Hinweise' }, { key: 'source_number', label: 'Bezugsdokument' },
  ],
  position: [
    { key: 'index', label: 'Laufende Nummer' }, { key: 'title', label: 'Bezeichnung' }, { key: 'description', label: 'Beschreibung' },
    { key: 'quantity', label: 'Menge' }, { key: 'unit', label: 'Einheit' }, { key: 'unit_code', label: 'Einheiten-Code' },
    { key: 'unit_price', label: 'Einzelpreis' }, { key: 'tax_percent', label: 'Steuersatz' }, { key: 'total', label: 'Gesamt' },
    { key: 'is_optional', label: 'Ist optional' }, { key: 'is_text', label: 'Ist Textzeile' }, { key: 'group', label: 'Gruppe' },
  ],
}

const EXTRA_RESERVED: Record<FieldScope, string[]> = {
  org: [], customer: [], contact: [],
  document: ['type', 'customer', 'contact', 'positions', 'groups'],
  position: ['kind', 'is_item', 'unit_name'],
}

export const isReservedKey = (scope: FieldScope, key: string) =>
  CORE_FIELDS[scope].some((f) => f.key === key) || EXTRA_RESERVED[scope].includes(key)

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

export const scopeHasDocTypes = (scope: FieldScope) => scope === 'document' || scope === 'position'

export function validateFieldDef(def: FieldDef, existing: FieldDef[]): string[] {
  const errors: string[] = []
  if (!def.label.trim()) errors.push('Bezeichnung fehlt.')
  if (!KEY_RE.test(def.key)) errors.push('Der Schlüssel darf nur Kleinbuchstaben, Ziffern und _ enthalten und muss mit einem Buchstaben beginnen.')
  else if (isReservedKey(def.scope, def.key)) errors.push(`„${def.key}“ ist ein Kernfeld und deshalb reserviert.`)
  if (existing.some((f) => f.scope === def.scope && f.key === def.key && f.id !== def.id)) errors.push(`Der Schlüssel „${def.key}“ ist auf dieser Ebene schon vergeben.`)
  if (def.type === 'select' && def.options.filter((o) => o.trim()).length === 0) errors.push('Auswahlfelder brauchen mindestens eine Option.')
  if (scopeHasDocTypes(def.scope) && def.docTypes.length === 0) errors.push('Wähle mindestens einen Dokumenttyp.')
  return errors
}

/** Eigene Felder einer Ebene, bei Dokument/Position gefiltert auf den Dokumenttyp. */
export function fieldsFor(defs: FieldDef[], scope: FieldScope, docType?: DocType): FieldDef[] {
  return defs.filter((d) => d.scope === scope && (!scopeHasDocTypes(scope) || !docType || d.docTypes.includes(docType)))
}

export const isEmptyValue = (v: FieldValue | undefined): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

export const defaultCustomValues = (defs: FieldDef[]): CustomValues =>
  Object.fromEntries(defs.filter((d) => d.defaultValue !== null).map((d) => [d.key, d.defaultValue]))
