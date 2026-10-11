import { describe, expect, it } from 'vitest'
import { calcTotals, effectiveTax, LEGAL_NOTES, type TaxContext } from './totals'
import type { Position, TaxRate } from './types'

const rates: TaxRate[] = [
  { id: 'r19', label: '19 %', percent: 19, category: 'S', exemptionNote: null },
  { id: 'r7', label: '7 %', percent: 7, category: 'S', exemptionNote: null },
]
const regular: TaxContext = { taxRates: rates, taxationMode: 'regular', taxTreatment: 'domestic' }

const pos = (over: Partial<Position>): Position => ({
  id: over.id ?? 'p', kind: 'item', title: 'X', description: '', quantity: 1, unitId: 'u',
  unitPrice: 0, taxRateId: 'r19', categoryId: null, custom: {}, ...over,
})

describe('effectiveTax', () => {
  it('uses the rate for regular domestic customers', () => {
    expect(effectiveTax('r7', regular)).toEqual({ percent: 7, category: 'S', note: null })
  })
  it('forces E with § 19 note for small businesses', () => {
    expect(effectiveTax('r19', { ...regular, taxationMode: 'small_business' }))
      .toEqual({ percent: 0, category: 'E', note: LEGAL_NOTES.smallBusiness })
  })
  it('forces AE for EU reverse charge and G for third countries', () => {
    expect(effectiveTax('r19', { ...regular, taxTreatment: 'eu_reverse_charge' })?.category).toBe('AE')
    expect(effectiveTax('r19', { ...regular, taxTreatment: 'third_country' })?.category).toBe('G')
  })
  it('returns null for an unknown (deleted) rate', () => {
    expect(effectiveTax('gone', regular)).toBeNull()
  })
})

describe('calcTotals', () => {
  it('sums lines and computes tax per rate group', () => {
    const t = calcTotals([
      pos({ id: 'a', quantity: 10, unitPrice: 95 }),
      pos({ id: 'b', quantity: 1, unitPrice: 49.9, taxRateId: 'r7' }),
    ], regular)
    expect(t.lines.a.net).toBe(950)
    expect(t.taxBreakdown).toEqual([
      { category: 'S', percent: 19, net: 950, tax: 180.5, gross: 1130.5 },
      { category: 'S', percent: 7, net: 49.9, tax: 3.49, gross: 53.39 },
    ])
    expect(t.net).toBe(999.9)
    expect(t.tax).toBe(183.99)
    expect(t.gross).toBe(1183.89)
  })

  it('builds groups from headings and ignores text lines', () => {
    const t = calcTotals([
      pos({ id: 'h1', kind: 'heading', title: 'Konzeption' }),
      pos({ id: 'a', quantity: 2, unitPrice: 100 }),
      pos({ id: 't', kind: 'text', title: 'Hinweis' }),
      pos({ id: 'h2', kind: 'heading', title: 'Umsetzung' }),
      pos({ id: 'b', quantity: 1, unitPrice: 50 }),
    ], regular)
    expect(t.groups).toEqual([
      { positionId: 'h1', title: 'Konzeption', net: 200 },
      { positionId: 'h2', title: 'Umsetzung', net: 50 },
    ])
    expect(t.lines.t).toBeUndefined()
  })

  it('excludes optional positions from the total', () => {
    const t = calcTotals([pos({ id: 'a', unitPrice: 100 }), pos({ id: 'o', kind: 'optional', unitPrice: 300 })], regular)
    expect(t.net).toBe(100)
    expect(t.optionalNet).toBe(300)
  })

  it('collects legal notes once', () => {
    const t = calcTotals([pos({ id: 'a', unitPrice: 10 }), pos({ id: 'b', unitPrice: 20 })], { ...regular, taxationMode: 'small_business' })
    expect(t.tax).toBe(0)
    expect(t.legalNotes).toEqual([LEGAL_NOTES.smallBusiness])
  })

  it('handles negative quantities (cancellations)', () => {
    const t = calcTotals([pos({ id: 'a', quantity: -10, unitPrice: 95 })], regular)
    expect(t.gross).toBe(-1130.5)
  })

  it('treats a deleted tax rate as 0 % and reports it', () => {
    const t = calcTotals([pos({ id: 'a', unitPrice: 100, taxRateId: 'gone' })], regular)
    expect(t.tax).toBe(0)
    expect(t.missingTaxRate).toEqual(['a'])
  })
})
