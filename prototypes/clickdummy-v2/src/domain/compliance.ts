import { fieldsFor, isEmptyValue } from './fields'
import { allPositions } from './types'
import type { Address, Contact, Customer, CustomValues, DocType, DocTypeConfig, Document, FieldDef, Organization, ProfileId, TaxRate, Unit } from './types'

export const PROFILE_LABELS: Record<ProfileId, string> = {
  basic: 'Basis',
  en16931: 'E-Rechnung (EN 16931)',
}

export const PROFILE_DESCRIPTIONS: Record<ProfileId, string> = {
  basic: 'Nur das Nötigste: Nummer, Datum, Kunde, Positionen. Überall nutzbar.',
  en16931: 'Europäische Norm für elektronische Rechnungen (ZUGFeRD / XRechnung). Das PDF bekommt eine eingebettete XML.',
}

export const PROFILE_TYPES: Record<ProfileId, DocType[]> = {
  basic: ['offer', 'confirmation', 'invoice', 'cancellation'],
  en16931: ['invoice', 'cancellation'],
}

/** Felder, die ein Profil zusätzlich verlangt, je Ebene — für die gesperrten Einträge unter „Eigene Felder“. */
export const PROFILE_REQUIREMENTS: Record<ProfileId, { scope: 'org' | 'customer' | 'document' | 'position'; key: string; label: string }[]> = {
  basic: [],
  en16931: [
    { scope: 'org', key: 'address', label: 'Vollständige Adresse' },
    { scope: 'org', key: 'vat_id', label: 'USt-ID oder Steuernummer' },
    { scope: 'org', key: 'iban', label: 'IBAN' },
    { scope: 'customer', key: 'address', label: 'Vollständige Adresse' },
    { scope: 'customer', key: 'vat_id', label: 'USt-ID (bei Reverse Charge)' },
    { scope: 'document', key: 'service_date', label: 'Leistungsdatum' },
    { scope: 'document', key: 'due_date', label: 'Fälligkeit' },
    { scope: 'position', key: 'unit', label: 'Einheit mit E-Rechnungs-Code' },
    { scope: 'position', key: 'quantity', label: 'Menge ungleich 0' },
  ],
}

/** path zeigt auf das Feld im Editor (data-path), damit die Prüfanzeige dorthin springen kann. */
export interface ComplianceIssue { path: string; message: string }
export interface ComplianceContext {
  doc: Document
  config: DocTypeConfig
  org: Organization
  customer: Customer | null
  contact: Contact | null
  units: Unit[]
  taxRates: TaxRate[]
  fieldDefs: FieldDef[]
}

const addressComplete = (a: Address) => [a.street, a.zip, a.city, a.country].every((v) => v.trim() !== '')

function requiredCustom(defs: FieldDef[], values: CustomValues, pathPrefix: string, labelPrefix: string): ComplianceIssue[] {
  return defs
    .filter((d) => d.required && isEmptyValue(values[d.key]))
    .map((d) => ({ path: `${pathPrefix}${d.key}`, message: `${labelPrefix}${d.label} fehlt.` }))
}

export function checkCompliance(ctx: ComplianceContext): ComplianceIssue[] {
  const { doc, config, org, customer, contact, units, taxRates, fieldDefs } = ctx
  const issues: ComplianceIssue[] = []
  const add = (path: string, message: string) => issues.push({ path, message })
  const items = allPositions(doc).filter((p) => p.kind === 'item')
  const name = (title: string) => `„${title || 'Position'}“`

  if (!doc.date) add('document.date', 'Datum fehlt.')
  if (!customer) add('document.customer', 'Kunde fehlt.')
  if (items.length === 0) add('positions', 'Mindestens eine Leistung ist nötig.')
  for (const p of items) {
    if (!p.title.trim()) add(`positions.${p.id}.title`, 'Eine Position hat keine Bezeichnung.')
    if (org.taxationMode === 'regular' && !taxRates.some((r) => r.id === p.taxRateId)) add(`positions.${p.id}.tax_rate`, `${name(p.title)}: Steuersatz fehlt oder wurde gelöscht.`)
    if (!units.some((u) => u.id === p.unitId)) add(`positions.${p.id}.unit`, `${name(p.title)}: Einheit fehlt oder wurde gelöscht.`)
  }
  issues.push(...requiredCustom(fieldsFor(fieldDefs, 'org'), org.custom, 'org.', 'Organisation: '))
  if (customer) issues.push(...requiredCustom(fieldsFor(fieldDefs, 'customer'), customer.custom, 'customer.', 'Kunde: '))
  if (contact) issues.push(...requiredCustom(fieldsFor(fieldDefs, 'contact'), contact.custom, 'contact.', 'Ansprechpartner: '))
  issues.push(...requiredCustom(fieldsFor(fieldDefs, 'document', doc.type), doc.custom, 'document.custom.', ''))
  const posDefs = fieldsFor(fieldDefs, 'position', doc.type)
  for (const p of items) issues.push(...requiredCustom(posDefs, p.custom, `positions.${p.id}.custom.`, `${name(p.title)}: `))

  if (config.profile !== 'en16931') return issues

  if (!org.name.trim() || !addressComplete(org.address)) add('org.address', 'Organisation: Name und vollständige Adresse fehlen.')
  if (!org.vatId.trim() && !org.taxNumber.trim()) add('org.vat_id', 'Organisation: USt-ID oder Steuernummer fehlt.')
  if (!org.iban.trim()) add('org.iban', 'Organisation: IBAN fehlt.')
  if (customer && !addressComplete(customer.address)) add('customer.address', 'Kunde: Die Adresse ist unvollständig.')
  if (customer?.taxTreatment === 'eu_reverse_charge' && !customer.vatId.trim()) add('customer.vat_id', 'Kunde: Bei Reverse Charge ist die USt-ID Pflicht.')
  if (!doc.serviceDate) add('document.service_date', 'Leistungsdatum fehlt.')
  if (doc.type === 'invoice' && !doc.dueDate) add('document.due_date', 'Fälligkeit fehlt.')
  for (const p of items) {
    const unit = units.find((u) => u.id === p.unitId)
    if (unit && !unit.code.trim()) add(`positions.${p.id}.unit`, `${name(p.title)}: Die Einheit hat keinen E-Rechnungs-Code.`)
    if (p.quantity === 0) add(`positions.${p.id}.quantity`, `${name(p.title)}: Die Menge darf nicht 0 sein.`)
  }
  return issues
}
