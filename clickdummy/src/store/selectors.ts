import { useMemo } from 'react'
import { checkCompliance } from '@/domain/compliance'
import type { TemplateContextInput } from '@/domain/templateContext'
import { calcTotals } from '@/domain/totals'
import type { Customer, Document } from '@/domain/types'
import { useCustomerStore } from './customerStore'
import { buildComplianceContextFor, useDocumentStore } from './documentStore'
import { useSettingsStore, type SettingsData } from './settingsStore'

export function documentTotals(doc: Document, settings: Pick<SettingsData, 'taxRates' | 'org'>, customers: Customer[]) {
  const customer = customers.find((c) => c.id === doc.customerId)
  return calcTotals(doc.positions, { taxRates: settings.taxRates, taxationMode: settings.org.taxationMode, taxTreatment: customer?.taxTreatment ?? 'domestic' })
}

export function useDocumentView(docId: string) {
  const documents = useDocumentStore((s) => s.documents)
  const customers = useCustomerStore((s) => s.customers)
  const settings = useSettingsStore()

  return useMemo(() => {
    const doc = documents.find((d) => d.id === docId)
    if (!doc) return null
    const config = settings.docTypes[doc.type]
    const customer = customers.find((c) => c.id === doc.customerId) ?? null
    const contact = customer?.contacts.find((c) => c.id === doc.contactId) ?? null
    const totals = documentTotals(doc, settings, customers)
    const issues = checkCompliance(buildComplianceContextFor(doc))
    const contextInput: TemplateContextInput = {
      doc, org: settings.org, customer, contact, units: settings.units, taxRates: settings.taxRates, categories: settings.categories,
      sourceNumber: documents.find((d) => d.id === doc.sourceId)?.number ?? null,
    }
    return { doc, config, customer, contact, totals, issues, contextInput }
  }, [documents, customers, settings, docId])
}
