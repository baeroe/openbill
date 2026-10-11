import type { Customer, CustomerTaxTreatment } from '@/domain/types'

export const TAX_TREATMENT_OPTIONS: { value: CustomerTaxTreatment; label: string; tag: string | null; description: string }[] = [
  { value: 'domestic', label: 'Inland', tag: null, description: 'Normale Umsatzsteuer nach den Steuersätzen der Positionen.' },
  { value: 'eu_reverse_charge', label: 'EU mit USt-ID', tag: 'EU · Reverse Charge', description: 'Keine Umsatzsteuer, der Kunde führt sie selbst ab. Seine USt-ID ist Pflicht.' },
  { value: 'third_country', label: 'Drittland', tag: 'Drittland', description: 'Außerhalb der EU. Die Leistung ist im Inland nicht steuerbar.' },
]

export const taxTag = (t: CustomerTaxTreatment) => TAX_TREATMENT_OPTIONS.find((o) => o.value === t)?.tag ?? null

export const initials = (name: string) =>
  name.replace(/\b(GmbH|AG|AB|e\.\s?V\.|KG|UG|Ltd|Inc)\b/gi, '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'

export const defaultContact = (c: Customer) => c.contacts.find((x) => x.isDefault) ?? c.contacts[0] ?? null

const regionNames = new Intl.DisplayNames(['de'], { type: 'region' })
export const countryName = (code: string) => {
  try { return code ? regionNames.of(code.toUpperCase()) ?? code : '' } catch { return code }
}
