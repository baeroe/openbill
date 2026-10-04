import { isEmptyValue } from './fields'
import type { Address, Customer, CustomValues, DocType, DocTypeConfig, Document, FieldDef, Organization, ProfileId, TaxRate, Unit } from './types'

export const PROFILE_LABELS: Record<ProfileId, string> = {
  basic: 'Basis',
  en16931: 'E-Rechnung (EN 16931)',
}

export const PROFILE_DESCRIPTIONS: Record<ProfileId, string> = {
  basic: 'Nur der Kern: Nummer, Datum, Kunde, Positionen. International nutzbar.',
  en16931: 'Europäische Norm für elektronische Rechnungen (ZUGFeRD / XRechnung). Erzeugt ein PDF mit eingebetteter XML.',
}

export const PROFILE_TYPES: Record<ProfileId, DocType[]> = {
  basic: ['offer', 'confirmation', 'invoice', 'cancellation'],
  en16931: ['invoice', 'cancellation'],
}

type ReqScope = 'org' | 'customer' | 'document' | 'position'
export const PROFILE_REQUIREMENTS: Record<ProfileId, { scope: ReqScope; key: string; label: string }[]> = {
  basic: [
    { scope: 'document', key: 'customer', label: 'Kunde' },
    { scope: 'position', key: 'title', label: 'Bezeichnung' },
  ],
  en16931: [
    { scope: 'org', key: 'address', label: 'Vollständige Adresse' },
    { scope: 'org', key: 'vat_id', label: 'USt-ID oder Steuernummer' },
    { scope: 'org', key: 'iban', label: 'IBAN' },
    { scope: 'customer', key: 'address', label: 'Vollständige Adresse' },
    { scope: 'customer', key: 'vat_id', label: 'USt-ID (bei Reverse Charge)' },
    { scope: 'document', key: 'service_date', label: 'Leistungsdatum' },
    { scope: 'document', key: 'due_date', label: 'Fälligkeit' },
    { scope: 'position', key: 'unit', label: 'Einheit mit E-Rechnungs-Code' },
    { scope: 'position', key: 'quantity', label: 'Menge ≠ 0' },
  ],
}

export interface ComplianceIssue { path: string; message: string }
export interface ComplianceContext {
  doc: Document
  config: DocTypeConfig
  org: Organization
  customer: Customer | null
  units: Unit[]
  taxRates: TaxRate[]
  orgFields: FieldDef[]
  customerFields: FieldDef[]
}

const addressComplete = (a: Address) => [a.street, a.zip, a.city, a.country].every((v) => v.trim() !== '')

function requiredCustom(defs: FieldDef[], values: CustomValues, pathPrefix: string, labelPrefix: string): ComplianceIssue[] {
  return defs
    .filter((d) => d.required && isEmptyValue(values[d.key]))
    .map((d) => ({ path: `${pathPrefix}${d.key}`, message: `${labelPrefix}${d.label} fehlt.` }))
}

export function checkCompliance(ctx: ComplianceContext): ComplianceIssue[] {
  const { doc, config, org, customer, units, taxRates } = ctx
  const issues: ComplianceIssue[] = []
  const add = (path: string, message: string) => issues.push({ path, message })
  const items = doc.positions.filter((p) => p.kind === 'item')
  const name = (title: string) => `„${title || 'Position'}“`

  if (!customer) add('document.customer', 'Kunde fehlt.')
  if (items.length === 0) add('positions', 'Mindestens eine Leistungsposition ist nötig.')
  for (const p of items) {
    if (!p.title.trim()) add(`positions.${p.id}.title`, 'Position ohne Bezeichnung.')
    if (org.taxationMode === 'regular' && !taxRates.some((r) => r.id === p.taxRateId)) add(`positions.${p.id}.tax_rate`, `${name(p.title)}: Steuersatz fehlt oder wurde gelöscht.`)
  }
  issues.push(...requiredCustom(ctx.orgFields, org.custom, 'org.', 'Organisation: '))
  if (customer) issues.push(...requiredCustom(ctx.customerFields, customer.custom, 'customer.', 'Kunde: '))
  issues.push(...requiredCustom(config.documentFields, doc.custom, 'document.custom.', ''))
  for (const p of items) issues.push(...requiredCustom(config.positionFields, p.custom, `positions.${p.id}.custom.`, `${name(p.title)}: `))

  if (config.profile !== 'en16931') return issues

  if (!org.name.trim() || !addressComplete(org.address)) add('org.address', 'Organisation: Name und vollständige Adresse fehlen.')
  if (!org.vatId.trim() && !org.taxNumber.trim()) add('org.vat_id', 'Organisation: USt-ID oder Steuernummer fehlt.')
  if (!org.iban.trim()) add('org.iban', 'Organisation: IBAN fehlt.')
  if (customer && !addressComplete(customer.address)) add('customer.address', 'Kunde: vollständige Adresse fehlt.')
  if (customer?.taxTreatment === 'eu_reverse_charge' && !customer.vatId.trim()) add('customer.vat_id', 'Kunde: USt-ID ist bei Reverse Charge Pflicht.')
  if (!doc.serviceDate) add('document.service_date', 'Leistungsdatum fehlt.')
  if (doc.type === 'invoice' && !doc.dueDate) add('document.due_date', 'Fälligkeit fehlt.')
  for (const p of items) {
    const unit = units.find((u) => u.id === p.unitId)
    if (!unit || !unit.code.trim()) add(`positions.${p.id}.unit`, `${name(p.title)}: Einheit mit E-Rechnungs-Code fehlt.`)
    if (p.quantity === 0) add(`positions.${p.id}.quantity`, `${name(p.title)}: Menge darf nicht 0 sein.`)
  }
  return issues
}
