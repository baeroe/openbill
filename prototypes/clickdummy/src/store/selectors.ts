import { useMemo } from 'react'
import { checkCompliance } from '@/domain/compliance'
import type { TemplateContextInput } from '@/domain/templateContext'
import { calcTotals } from '@/domain/totals'
import type { Customer, Document } from '@/domain/types'
import { useCustomerStore } from './customerStore'
import { buildComplianceContextFor, useDocumentStore } from './documentStore'
import { useSettingsStore, type SettingsData } from './settingsStore'

/** Abgeschlossene Dokumente rechnen mit ihrem Snapshot, Entwürfe mit den aktuellen Stammdaten. */
export function documentSources(doc: Document, settings: Pick<SettingsData, 'taxRates' | 'org' | 'units' | 'categories'>, customers: Customer[]) {
  if (doc.snapshot) return doc.snapshot
  return { org: settings.org, taxRates: settings.taxRates, units: settings.units, categories: settings.categories, customer: customers.find((c) => c.id === doc.customerId) ?? null }
}

export function documentTotals(doc: Document, settings: Pick<SettingsData, 'taxRates' | 'org' | 'units' | 'categories'>, customers: Customer[]) {
  const src = documentSources(doc, settings, customers)
  return calcTotals(doc.positions, { taxRates: src.taxRates, taxationMode: src.org.taxationMode, taxTreatment: src.customer?.taxTreatment ?? 'domestic' })
}

export function useDocumentView(docId: string) {
  const documents = useDocumentStore((s) => s.documents)
  const customers = useCustomerStore((s) => s.customers)
  const settings = useSettingsStore()

  return useMemo(() => {
    const doc = documents.find((d) => d.id === docId)
    if (!doc) return null
    const config = settings.docTypes[doc.type]
    const src = documentSources(doc, settings, customers)
    const customer = src.customer
    const contact = customer?.contacts.find((c) => c.id === doc.contactId) ?? null
    const totals = documentTotals(doc, settings, customers)
    const issues = doc.snapshot ? [] : checkCompliance(buildComplianceContextFor(doc))
    const contextInput: TemplateContextInput = {
      doc, org: src.org, customer, contact, units: src.units, taxRates: src.taxRates, categories: src.categories,
      sourceNumber: documents.find((d) => d.id === doc.sourceId)?.number ?? null,
    }
    return { doc, config, customer, contact, totals, issues, contextInput }
  }, [documents, customers, settings, docId])
}
