import type { TaxCategory } from './types'

export const TAX_CATEGORY_LABELS: Record<TaxCategory, string> = {
  S: 'Normalsatz',
  Z: 'Nullsatz',
  E: 'Steuerbefreit',
  AE: 'Reverse Charge',
  K: 'Innergemeinschaftliche Lieferung',
  G: 'Ausfuhr / Drittland',
}
