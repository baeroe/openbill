import { scopeHasDocTypes } from '@/domain/fields'
import { DOC_TYPES, type DocType, type FieldDef, type FieldScope } from '@/domain/types'

export const DOC_TYPE_SHORT: Record<DocType, string> = { offer: 'AN', confirmation: 'AB', invoice: 'RE', cancellation: 'ST' }

export const SCOPE_INTRO: Record<FieldScope, string> = {
  org: 'Angaben zu deiner eigenen Firma, die auf jedem Dokument stehen können, etwa Handelsregister oder Geschäftsführung.',
  customer: 'Zusätzliche Stammdaten pro Kunde, zum Beispiel Branche oder die Lieferantennummer, unter der er dich führt.',
  contact: 'Angaben zu einzelnen Ansprechpartnern eines Kunden, etwa Abteilung oder Durchwahl.',
  document: 'Felder im Kopf eines Dokuments. Du legst sie einmal an und wählst, für welche Dokumenttypen sie gelten.',
  position: 'Felder an jeder Position. Auch hier wählst du pro Feld, für welche Dokumenttypen es gilt.',
}

export const SCOPE_EXAMPLES: Record<FieldScope, { label: string; type: 'text' | 'select' | 'date' | 'textarea' | 'number' }[]> = {
  org: [{ label: 'Handelsregister', type: 'text' }, { label: 'Geschäftsführung', type: 'text' }],
  customer: [{ label: 'Lieferantennummer', type: 'text' }, { label: 'Branche', type: 'select' }],
  contact: [{ label: 'Abteilung', type: 'text' }, { label: 'Geburtstag', type: 'date' }],
  document: [{ label: 'Projektname', type: 'text' }, { label: 'Bestellnummer des Kunden', type: 'text' }],
  position: [{ label: 'Ticket', type: 'text' }, { label: 'Leistungsmonat', type: 'date' }],
}

export const emptyFieldDef = (scope: FieldScope): FieldDef => ({
  id: '', scope, key: '', label: '', type: 'text', required: false, defaultValue: null, help: '', options: [],
  docTypes: scopeHasDocTypes(scope) ? [...DOC_TYPES] : [],
})
