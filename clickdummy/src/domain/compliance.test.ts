import { describe, expect, it } from 'vitest'
import { checkCompliance, type ComplianceContext } from './compliance'
import type { Document, Position } from './types'

const item = (over: Partial<Position> = {}): Position => ({ id: 'p1', kind: 'item', title: 'X', description: '', quantity: 1, unitId: 'u', unitPrice: 1, taxRateId: 'r', categoryId: null, custom: {}, ...over })
const doc = (over: Partial<Document> = {}): Document => ({
  id: 'd', type: 'offer', status: 'draft', number: null, date: '2026-10-04', customerId: 'c', contactId: null, serviceDate: null, serviceDateEnd: null,
  dueDate: null, validUntil: null, intro: '', closing: '', templateId: 't', positions: [item()], custom: {}, sourceId: null, cancelledById: null,
  finalizedAt: null, createdAt: '', updatedAt: '', snapshot: null, ...over,
})
const ctx = (d: Document): ComplianceContext => ({
  doc: d,
  config: { type: 'offer', label: '', profile: 'basic', numbering: { pattern: '', nextSeq: 1, resetYearly: false, lastYear: null }, templateId: 't', defaultIntroBlockId: null, defaultClosingBlockId: null, paymentTermDays: null, validityDays: null, documentFields: [], positionFields: [] },
  org: { name: 'O', address: { street: 's', zip: 'z', city: 'c', country: 'DE' }, logo: null, vatId: 'DE1', taxNumber: '', iban: 'X', bic: '', bankName: '', email: '', phone: '', website: '', taxationMode: 'regular', custom: {} },
  customer: { id: 'c', number: '1', name: 'C', address: { street: 's', zip: 'z', city: 'c', country: 'DE' }, email: '', vatId: '', taxTreatment: 'domestic', contacts: [], custom: {} },
  units: [{ id: 'u', name: 'Stunde', symbol: 'Std.', decimals: 2, code: 'HUR' }],
  taxRates: [{ id: 'r', label: '19', percent: 19, category: 'S', exemptionNote: null }],
  orgFields: [], customerFields: [],
})
const paths = (d: Document) => checkCompliance(ctx(d)).map((i) => i.path)

describe('checkCompliance (basic)', () => {
  it('passes a complete offer', () => expect(paths(doc())).toEqual([]))
  it('requires a date', () => expect(paths(doc({ date: '' }))).toContain('document.date'))
  it('reports a deleted unit even without e-invoice profile', () => expect(paths(doc({ positions: [item({ unitId: 'gone' })] }))).toContain('positions.p1.unit'))
  it('reports a deleted tax rate', () => expect(paths(doc({ positions: [item({ taxRateId: 'gone' })] }))).toContain('positions.p1.tax_rate'))
})
