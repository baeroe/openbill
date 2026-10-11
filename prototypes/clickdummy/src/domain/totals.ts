import { round2 } from './money'
import type { CustomerTaxTreatment, Position, TaxCategory, TaxationMode, TaxRate } from './types'

export const LEGAL_NOTES = {
  smallBusiness: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
  reverseCharge: 'Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge).',
  thirdCountry: 'Nicht im Inland steuerbare Leistung.',
} as const

export interface TaxContext { taxRates: TaxRate[]; taxationMode: TaxationMode; taxTreatment: CustomerTaxTreatment }
export interface EffectiveTax { percent: number; category: TaxCategory; note: string | null }
export interface LineTotal { positionId: string; net: number; tax: EffectiveTax | null }
export interface GroupTotal { positionId: string; title: string; net: number }
export interface TaxBreakdownRow { category: TaxCategory; percent: number; net: number; tax: number; gross: number }
export interface Totals {
  lines: Record<string, LineTotal>
  groups: GroupTotal[]
  taxBreakdown: TaxBreakdownRow[]
  net: number
  tax: number
  gross: number
  optionalNet: number
  legalNotes: string[]
  missingTaxRate: string[]
}

export function effectiveTax(taxRateId: string | null, ctx: TaxContext): EffectiveTax | null {
  if (ctx.taxationMode === 'small_business') return { percent: 0, category: 'E', note: LEGAL_NOTES.smallBusiness }
  if (ctx.taxTreatment === 'eu_reverse_charge') return { percent: 0, category: 'AE', note: LEGAL_NOTES.reverseCharge }
  if (ctx.taxTreatment === 'third_country') return { percent: 0, category: 'G', note: LEGAL_NOTES.thirdCountry }
  const rate = ctx.taxRates.find((r) => r.id === taxRateId)
  if (!rate) return null
  return { percent: rate.percent, category: rate.category, note: rate.exemptionNote }
}

export function calcTotals(positions: Position[], ctx: TaxContext): Totals {
  const lines: Record<string, LineTotal> = {}
  const groups: GroupTotal[] = []
  const buckets = new Map<string, TaxBreakdownRow>()
  const notes = new Set<string>()
  const missingTaxRate: string[] = []
  let optionalNet = 0
  let current: GroupTotal | null = null

  for (const p of positions) {
    if (p.kind === 'heading') {
      current = { positionId: p.id, title: p.title, net: 0 }
      groups.push(current)
      continue
    }
    if (p.kind === 'text') continue

    const net = round2(p.quantity * p.unitPrice)
    const tax = effectiveTax(p.taxRateId, ctx)
    lines[p.id] = { positionId: p.id, net, tax }
    if (p.kind === 'optional') {
      optionalNet = round2(optionalNet + net)
      continue
    }
    if (!tax) missingTaxRate.push(p.id)
    if (current) current.net = round2(current.net + net)

    const t: EffectiveTax = tax ?? { percent: 0, category: 'S', note: null }
    const key = `${t.category}:${t.percent}`
    const row = buckets.get(key) ?? { category: t.category, percent: t.percent, net: 0, tax: 0, gross: 0 }
    row.net = round2(row.net + net)
    buckets.set(key, row)
    if (t.note) notes.add(t.note)
  }

  const taxBreakdown = [...buckets.values()]
    .map((r) => {
      const tax = round2((r.net * r.percent) / 100)
      return { ...r, tax, gross: round2(r.net + tax) }
    })
    .sort((a, b) => b.percent - a.percent)
  const net = round2(taxBreakdown.reduce((s, r) => s + r.net, 0))
  const tax = round2(taxBreakdown.reduce((s, r) => s + r.tax, 0))

  return { lines, groups, taxBreakdown, net, tax, gross: round2(net + tax), optionalNet, legalNotes: [...notes], missingTaxRate }
}
