export type DocType = 'offer' | 'confirmation' | 'invoice' | 'cancellation'
export const DOC_TYPES: DocType[] = ['offer', 'confirmation', 'invoice', 'cancellation']
export type DocStatus = 'draft' | 'open' | 'accepted' | 'rejected' | 'done' | 'paid' | 'cancelled' | 'closed'

export type FieldType = 'text' | 'textarea' | 'number' | 'money' | 'date' | 'select' | 'boolean' | 'image'
export type FieldValue = string | number | boolean | null
export type CustomValues = Record<string, FieldValue>

/** Ebenen, auf denen eigene Felder gepflegt werden — alle an einem Ort. */
export type FieldScope = 'org' | 'customer' | 'contact' | 'document' | 'position'
export const FIELD_SCOPES: FieldScope[] = ['org', 'customer', 'contact', 'document', 'position']

export interface FieldDef {
  id: string
  scope: FieldScope
  key: string
  label: string
  type: FieldType
  required: boolean
  defaultValue: FieldValue
  help: string
  options: string[]
  /** Nur für Dokument- und Positionsfelder: für welche Dokumenttypen das Feld gilt. */
  docTypes: DocType[]
}

export type ProfileId = 'basic' | 'en16931'

export type TaxCategory = 'S' | 'Z' | 'E' | 'AE' | 'K' | 'G'
export interface TaxRate { id: string; label: string; percent: number; category: TaxCategory; exemptionNote: string | null }
export interface Unit { id: string; name: string; symbol: string; decimals: number; code: string }
export type TextBlockKind = 'intro' | 'closing' | 'payment' | 'note'
export interface TextBlock { id: string; name: string; kind: TextBlockKind; body: string }
export interface User { id: string; name: string; email: string; role: 'owner' | 'member' }

export type TaxationMode = 'regular' | 'small_business'
export type CustomerTaxTreatment = 'domestic' | 'eu_reverse_charge' | 'third_country'

export interface Address { street: string; zip: string; city: string; country: string }

export interface Organization {
  name: string
  address: Address
  logo: string | null
  vatId: string
  taxNumber: string
  iban: string
  bic: string
  bankName: string
  email: string
  phone: string
  website: string
  taxationMode: TaxationMode
  custom: CustomValues
}

export interface Contact {
  id: string
  salutation: string
  firstName: string
  lastName: string
  position: string
  email: string
  phone: string
  isDefault: boolean
  custom: CustomValues
}

export interface Customer {
  id: string
  number: string
  name: string
  address: Address
  email: string
  vatId: string
  taxTreatment: CustomerTaxTreatment
  contacts: Contact[]
  custom: CustomValues
  createdAt: string
}

export type PositionKind = 'item' | 'text' | 'optional'
export interface Position {
  id: string
  kind: PositionKind
  title: string
  description: string
  quantity: number
  unitId: string | null
  unitPrice: number
  taxRateId: string | null
  custom: CustomValues
}

/**
 * Positionsgruppe im Dokument. Eine Gruppe ohne Titel (title === null) steht für lose Positionen
 * und wird ohne Überschrift und Zwischensumme gezeigt.
 */
export interface PositionGroup {
  id: string
  title: string | null
  positions: Position[]
}

/** nextSeq gilt für lastYear; bei jährlichem Reset merkt sich yearSeqs die Zähler früherer Jahre. */
export interface NumberState { pattern: string; nextSeq: number; resetYearly: boolean; lastYear: number | null; yearSeqs?: Record<string, number> }

/** Was zum Dokumenttyp gehört. Eigene Felder stehen zentral unter fieldDefs. */
export interface DocTypeConfig {
  type: DocType
  label: string
  profile: ProfileId
  numbering: NumberState
  templateId: string
  defaultIntroBlockId: string | null
  defaultClosingBlockId: string | null
  paymentTermDays: number | null
  validityDays: number | null
}

export interface Document {
  id: string
  type: DocType
  status: DocStatus
  number: string | null
  date: string
  customerId: string | null
  contactId: string | null
  serviceDate: string | null
  serviceDateEnd: string | null
  dueDate: string | null
  validUntil: string | null
  intro: string
  closing: string
  templateId: string
  groups: PositionGroup[]
  custom: CustomValues
  sourceId: string | null
  cancelledById: string | null
  finalizedAt: string | null
  /** Zeitpunkt, zu dem die Rechnung als bezahlt markiert wurde. */
  paidAt?: string | null
  /** Stammdaten zum Zeitpunkt des Abschließens (GoBD): spätere Änderungen wirken nicht mehr auf das Dokument. */
  snapshot: DocumentSnapshot | null
  createdAt: string
  updatedAt: string
}

export interface DocumentSnapshot {
  org: Organization
  customer: Customer | null
  taxRates: TaxRate[]
  units: Unit[]
}

export type ExpectedFieldScope = FieldScope
export interface TemplateManifest {
  name: string
  version: string
  author: string
  license: string
  description: string
  documentTypes: DocType[]
  expectedFields: { scope: ExpectedFieldScope; key: string; type: FieldType; fallback: string }[]
  /** Kopf- und Fußzeilenhöhe sind die oberen/unteren Seitenränder (Gotenberg marginTop/marginBottom). */
  paper: { format: 'A4' | 'Letter'; marginX: string; headerHeight: string; footerHeight: string }
}

export interface Template {
  id: string
  builtIn: boolean
  manifest: TemplateManifest
  /** Kopfzeile, auf jeder Seite wiederholt, eigener Kontext ohne das CSS des Inhalts */
  header: string
  liquid: string
  css: string
  /** Fußzeile, auf jeder Seite wiederholt */
  footer: string
}

export interface Settings {
  org: Organization
  docTypes: Record<DocType, DocTypeConfig>
  taxRates: TaxRate[]
  units: Unit[]
  textBlocks: TextBlock[]
  users: User[]
  fieldDefs: FieldDef[]
}

/** Alle Positionen eines Dokuments in Reihenfolge, über Gruppen hinweg. */
export const allPositions = (doc: Pick<Document, 'groups'>): Position[] => doc.groups.flatMap((g) => g.positions)
