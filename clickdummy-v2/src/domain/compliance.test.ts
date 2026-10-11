import { describe, expect, it } from 'vitest'
import { checkCompliance, type ComplianceContext } from './compliance'
import type { Document, FieldDef, Position } from './types'

const item = (over: Partial<Position> = {}): Position => ({ id: 'p1', kind: 'item', title: 'X', description: '', quantity: 1, unitId: 'u', unitPrice: 1, taxRateId: 'r', custom: {}, ...over })
const doc = (over: Partial<Document> = {}, positions: Position[] = [item()]): Document => ({
  id: 'd', type: 'offer', status: 'draft', number: null, date: '2026-10-04', customerId: 'c', contactId: null, serviceDate: null, serviceDateEnd: null,
  dueDate: null, validUntil: null, intro: '', closing: '', templateId: 't', groups: [{ id: 'g', title: null, positions }], custom: {}, sourceId: null, cancelledById: null,
  finalizedAt: null, createdAt: '', updatedAt: '', snapshot: null, ...over,
})
const ctx = (d: Document, fieldDefs: FieldDef[] = [], profile: 'basic' | 'en16931' = 'basic'): ComplianceContext => ({
  doc: d,
  config: { type: d.type, label: '', profile, numbering: { pattern: '', nextSeq: 1, resetYearly: false, lastYear: null }, templateId: 't', defaultIntroBlockId: null, defaultClosingBlockId: null, paymentTermDays: null, validityDays: null },
  org: { name: 'O', address: { street: 's', zip: 'z', city: 'c', country: 'DE' }, logo: null, vatId: 'DE1', taxNumber: '', iban: 'X', bic: '', bankName: '', email: '', phone: '', website: '', taxationMode: 'regular', custom: {} },
  customer: { id: 'c', number: '1', name: 'C', address: { street: 's', zip: 'z', city: 'c', country: 'DE' }, email: '', vatId: '', taxTreatment: 'domestic', contacts: [], custom: {}, createdAt: '' },
  contact: null,
  units: [{ id: 'u', name: 'Stunde', symbol: 'Std.', decimals: 2, code: 'HUR' }],
  taxRates: [{ id: 'r', label: '19', percent: 19, category: 'S', exemptionNote: null }],
  fieldDefs,
})
const paths = (c: ComplianceContext) => checkCompliance(c).map((i) => i.path)

describe('checkCompliance', () => {
  it('passes a complete offer', () => expect(paths(ctx(doc()))).toEqual([]))
  it('requires a date', () => expect(paths(ctx(doc({ date: '' })))).toContain('document.date'))
  it('reports a deleted unit and tax rate', () => {
    expect(paths(ctx(doc({}, [item({ unitId: 'gone', taxRateId: 'gone' })])))).toEqual(['positions.p1.tax_rate', 'positions.p1.unit'])
  })
  it('checks required document fields only for their doc types', () => {
    const def: FieldDef = { id: 'f', scope: 'document', key: 'po_number', label: 'Bestellnummer', type: 'text', required: true, defaultValue: null, help: '', options: [], docTypes: ['invoice'] }
    expect(paths(ctx(doc(), [def]))).toEqual([])
    expect(paths(ctx(doc({ type: 'invoice' }), [def]))).toContain('document.custom.po_number')
  })
  it('requires service date and due date for e-invoices', () => {
    expect(paths(ctx(doc({ type: 'invoice' }), [], 'en16931'))).toEqual(['document.service_date', 'document.due_date'])
  })
})
