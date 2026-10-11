import type { DocType } from '@/domain/types'

export const CONVERT_LABELS: Record<DocType, string> = {
  offer: 'In Angebot umwandeln',
  confirmation: 'In Auftragsbestätigung umwandeln',
  invoice: 'In Rechnung umwandeln',
  cancellation: 'Stornieren',
}

export const TAX_TREATMENT_LABELS = {
  domestic: 'Inland',
  eu_reverse_charge: 'EU, Reverse Charge',
  third_country: 'Drittland',
} as const
