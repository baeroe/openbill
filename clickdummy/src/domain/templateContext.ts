import { DOC_TYPE_LABELS } from './lifecycle'
import { calcTotals } from './totals'
import type { Category, Contact, Customer, Document, Organization, TaxRate, Unit } from './types'

export interface TemplateContextInput {
  doc: Document
  org: Organization
  customer: Customer | null
  contact: Contact | null
  units: Unit[]
  taxRates: TaxRate[]
  categories: Category[]
  sourceNumber: string | null
}

export type TemplateContext = {
  org: Record<string, unknown>
  customer: Record<string, unknown> | null
  contact: Record<string, unknown> | null
  document: Record<string, unknown>
  positions: Record<string, unknown>[]
  groups: { title: string; total: number }[]
}

/** Baut den Liquid-Kontext. Kernwerte stehen nach den eigenen Feldern, damit eigene Felder sie nie überschreiben. */
export function buildTemplateContext(input: TemplateContextInput): TemplateContext {
  const { doc, org, customer, contact, units, taxRates, categories } = input
  const totals = calcTotals(doc.positions, {
    taxRates,
    taxationMode: org.taxationMode,
    taxTreatment: customer?.taxTreatment ?? 'domestic',
  })

  let index = 0
  const positions = doc.positions.map((p) => {
    const unit = units.find((u) => u.id === p.unitId)
    const line = totals.lines[p.id]
    const counted = p.kind === 'item' || p.kind === 'optional'
    return {
      ...p.custom,
      index: counted ? ++index : null,
      kind: p.kind,
      is_item: p.kind === 'item',
      is_heading: p.kind === 'heading',
      is_text: p.kind === 'text',
      is_optional: p.kind === 'optional',
      title: p.title,
      description: p.description,
      quantity: p.quantity,
      unit: unit?.symbol ?? '',
      unit_name: unit?.name ?? '',
      unit_code: unit?.code ?? '',
      unit_price: p.unitPrice,
      tax_percent: line?.tax?.percent ?? 0,
      category: categories.find((c) => c.id === p.categoryId)?.name ?? '',
      total: line?.net ?? 0,
    }
  })

  return {
    org: {
      ...org.custom,
      name: org.name, street: org.address.street, zip: org.address.zip, city: org.address.city, country: org.address.country,
      logo: org.logo, vat_id: org.vatId, tax_number: org.taxNumber, iban: org.iban, bic: org.bic, bank_name: org.bankName,
      email: org.email, phone: org.phone, website: org.website, small_business: org.taxationMode === 'small_business',
    },
    customer: customer && {
      ...customer.custom,
      number: customer.number, name: customer.name, street: customer.address.street, zip: customer.address.zip,
      city: customer.address.city, country: customer.address.country, email: customer.email, vat_id: customer.vatId,
      tax_treatment: customer.taxTreatment,
    },
    contact: contact && {
      ...contact.custom,
      salutation: contact.salutation, first_name: contact.firstName, last_name: contact.lastName,
      full_name: `${contact.firstName} ${contact.lastName}`.trim(), position: contact.position, email: contact.email, phone: contact.phone,
    },
    document: {
      ...doc.custom,
      type: doc.type, type_label: DOC_TYPE_LABELS[doc.type], status: doc.status, number: doc.number ?? 'Entwurf',
      date: doc.date, due_date: doc.dueDate, valid_until: doc.validUntil, service_date: doc.serviceDate, service_date_end: doc.serviceDateEnd,
      intro: doc.intro, closing: doc.closing,
      net_total: totals.net, tax_total: totals.tax, gross_total: totals.gross, optional_total: totals.optionalNet,
      tax_breakdown: totals.taxBreakdown, legal_notes: totals.legalNotes, source_number: input.sourceNumber,
    },
    positions,
    groups: totals.groups.map((g) => ({ title: g.title, total: g.net })),
  }
}
