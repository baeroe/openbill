import { beforeEach, describe, expect, it } from 'vitest'
import { useCatalogStore } from './catalogStore'
import { useDocumentStore } from './documentStore'
import { resetDemo } from './reset'

const docs = () => useDocumentStore.getState()
const get = (id: string) => docs().documents.find((d) => d.id === id)!
const year = new Date().getFullYear()

beforeEach(() => resetDemo())

describe('document flow', () => {
  it('runs offer → invoice → cancellation', () => {
    const offerId = docs().createDocument('offer', 'cus-bohnenwerk')
    expect(get(offerId).contactId).toBe('con-ida')
    docs().insertCatalogItem(offerId, useCatalogStore.getState().items.find((i) => i.id === 'ci-dev')!)
    expect(get(offerId).positions[0]).toMatchObject({ title: 'Entwicklung', unitPrice: 95, custom: { phase: 'Umsetzung' } })

    expect(docs().finalizeDocument(offerId)).toEqual({ ok: true })
    expect(get(offerId)).toMatchObject({ status: 'open', number: `AN-${year}-0003` })
    docs().setStatus(offerId, 'accepted')

    const { id: invoiceId } = docs().convertTo(offerId, 'invoice')
    expect(docs().finalizeDocument(invoiceId)).toEqual({ ok: true })
    expect(get(invoiceId).number).toBe(`RE-${year}-0003`)

    const { id: stornoId } = docs().convertTo(invoiceId, 'cancellation')
    expect(get(stornoId).positions[0].quantity).toBe(-1)
    expect(docs().finalizeDocument(stornoId)).toEqual({ ok: true })
    expect(get(invoiceId)).toMatchObject({ status: 'cancelled', cancelledById: stornoId })
    expect(() => docs().convertTo(invoiceId, 'cancellation')).toThrow()
  })

  it('blocks finalizing when the profile check fails', () => {
    const id = docs().createDocument('invoice', 'cus-bohnenwerk')
    const r = docs().finalizeDocument(id)
    expect(r.ok).toBe(false)
    expect(get(id).number).toBeNull()
  })

  it('refuses to change finalized documents', () => {
    const before = get('doc-invoice-1')
    docs().updateDocument('doc-invoice-1', { intro: 'x' })
    docs().addPosition('doc-invoice-1', 'item')
    docs().deleteDraft('doc-invoice-1')
    expect(get('doc-invoice-1')).toEqual(before)
  })

  it('only allows documented status changes', () => {
    docs().setStatus('doc-offer-3', 'accepted')
    expect(get('doc-offer-3').status).toBe('draft')
    docs().setStatus('doc-invoice-1', 'paid')
    expect(get('doc-invoice-1').status).toBe('paid')
  })
})

describe('review fixes', () => {
  it('freezes totals of finalized documents against master data changes', async () => {
    const { useSettingsStore } = await import('./settingsStore')
    const { useCustomerStore } = await import('./customerStore')
    const { documentTotals } = await import('./selectors')
    const before = documentTotals(get('doc-invoice-2'), useSettingsStore.getState(), useCustomerStore.getState().customers).gross
    useSettingsStore.getState().removeTaxRate('tax-19')
    useSettingsStore.getState().updateOrg({ taxationMode: 'small_business' })
    const after = documentTotals(get('doc-invoice-2'), useSettingsStore.getState(), useCustomerStore.getState().customers).gross
    expect(after).toBe(before)
  })

  it('stores a snapshot when finalizing', () => {
    const id = docs().createDocument('offer', 'cus-alpen')
    docs().insertCatalogItem(id, useCatalogStore.getState().items[0])
    docs().finalizeDocument(id)
    expect(get(id).snapshot?.customer?.name).toBe('Hotel Alpenglück')
  })

  it('does not duplicate cancellations', () => {
    const { id: stornoId } = docs().convertTo('doc-invoice-1', 'cancellation')
    expect(() => docs().duplicateDocument(stornoId)).toThrow()
  })
})
