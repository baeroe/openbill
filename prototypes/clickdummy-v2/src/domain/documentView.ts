import { checkCompliance, type ComplianceIssue } from './compliance'
import type { TemplateContextInput } from './templateContext'
import { calcTotals, type Totals } from './totals'
import type { Contact, Customer, Document, Settings } from './types'

/** Abgeschlossene Dokumente rechnen mit ihrem Snapshot, Entwürfe mit den aktuellen Stammdaten. */
export function documentSources(doc: Document, settings: Settings, customers: Customer[]) {
  if (doc.snapshot) return doc.snapshot
  return { org: settings.org, taxRates: settings.taxRates, units: settings.units, customer: customers.find((c) => c.id === doc.customerId) ?? null }
}

export function documentTotals(doc: Document, settings: Settings, customers: Customer[]): Totals {
  const src = documentSources(doc, settings, customers)
  return calcTotals(doc.groups, { taxRates: src.taxRates, taxationMode: src.org.taxationMode, taxTreatment: src.customer?.taxTreatment ?? 'domestic' })
}

export interface DocumentView {
  doc: Document
  customer: Customer | null
  contact: Contact | null
  totals: Totals
  issues: ComplianceIssue[]
  contextInput: TemplateContextInput
}

export function buildDocumentView(doc: Document, settings: Settings, customers: Customer[], documents: Pick<Document, 'id' | 'number'>[]): DocumentView {
  const src = documentSources(doc, settings, customers)
  const customer = src.customer
  const contact = customer?.contacts.find((c) => c.id === doc.contactId) ?? null
  const totals = documentTotals(doc, settings, customers)
  const issues = doc.snapshot ? [] : checkCompliance({
    doc, config: settings.docTypes[doc.type], org: src.org, customer, contact, units: src.units, taxRates: src.taxRates, fieldDefs: settings.fieldDefs,
  })
  const contextInput: TemplateContextInput = {
    doc, org: src.org, customer, contact, units: src.units, taxRates: src.taxRates,
    sourceNumber: documents.find((d) => d.id === doc.sourceId)?.number ?? null,
  }
  return { doc, customer, contact, totals, issues, contextInput }
}
