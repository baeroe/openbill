import { describe, expect, it } from 'vitest'
import { canConvert, convertDocument } from './convert'
import type { DocTypeConfig, Document, FieldDef } from './types'

let n = 0
const newId = () => `id${++n}`
const cfg: DocTypeConfig = {
  type: 'invoice', label: 'Rechnung', profile: 'basic', numbering: { pattern: 'RE-{0000}', nextSeq: 1, resetYearly: false, lastYear: null },
  templateId: 't', defaultIntroBlockId: null, defaultClosingBlockId: null, paymentTermDays: 14, validityDays: null,
}
const field = (id: string, scope: 'document' | 'position', key: string, docTypes: FieldDef['docTypes']): FieldDef =>
  ({ id, scope, key, label: key, type: 'text', required: false, defaultValue: null, help: '', options: [], docTypes })

const offer: Document = {
  id: 'o1', type: 'offer', status: 'accepted', number: 'AN-1', date: '2026-10-01', customerId: 'c', contactId: null,
  serviceDate: null, serviceDateEnd: null, dueDate: null, validUntil: '2026-10-31', intro: 'Hallo', closing: 'Gruß', templateId: 't',
  custom: { project_name: 'Shop', offer_note: 'nur AN' },
  groups: [
    { id: 'g1', title: 'Konzept', positions: [
      { id: 'p1', kind: 'item', title: 'Workshop', description: '', quantity: 1, unitId: 'u', unitPrice: 890, taxRateId: 'r', custom: { ref: 'A' } },
      { id: 'p2', kind: 'optional', title: 'Extra', description: '', quantity: 1, unitId: 'u', unitPrice: 100, taxRateId: 'r', custom: {} },
    ] },
    { id: 'g2', title: 'Nur optional', positions: [
      { id: 'p3', kind: 'optional', title: 'Hosting', description: '', quantity: 12, unitId: 'u', unitPrice: 49, taxRateId: 'r', custom: {} },
    ] },
  ],
  sourceId: null, cancelledById: null, finalizedAt: '2026-10-01', snapshot: null, createdAt: '', updatedAt: '',
}
const defs = [field('a', 'document', 'project_name', ['offer', 'invoice']), field('b', 'document', 'offer_note', ['offer']), field('c', 'position', 'ref', ['offer', 'invoice'])]

describe('convertDocument', () => {
  it('only allows accepted offers', () => {
    expect(canConvert({ ...offer, status: 'open' }, 'invoice')).toBe(false)
    expect(canConvert(offer, 'invoice')).toBe(true)
  })

  it('keeps groups, drops optional positions and empty groups, keeps fields valid for the target', () => {
    const { document, droppedFields } = convertDocument(offer, 'invoice', { targetConfig: cfg, fieldDefs: defs, today: '2026-10-11', now: 'now', newId })
    expect(document.groups.map((g) => g.title)).toEqual(['Konzept'])
    expect(document.groups[0].positions.map((p) => p.title)).toEqual(['Workshop'])
    expect(document.groups[0].positions[0].custom).toEqual({ ref: 'A' })
    expect(document.custom).toEqual({ project_name: 'Shop' })
    expect(droppedFields).toEqual(['offer_note'])
    expect(document.dueDate).toBe('2026-10-25')
    expect(document.sourceId).toBe('o1')
  })

  it('negates quantities for cancellations', () => {
    const invoice: Document = { ...offer, id: 'i1', type: 'invoice', status: 'open', groups: [offer.groups[0]] }
    const { document } = convertDocument(invoice, 'cancellation', { targetConfig: { ...cfg, type: 'cancellation' }, fieldDefs: defs, today: '2026-10-11', now: 'now', newId })
    expect(document.groups[0].positions[0].quantity).toBe(-1)
  })
})
