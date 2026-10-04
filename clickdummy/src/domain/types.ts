export type DocType = 'offer' | 'confirmation' | 'invoice' | 'cancellation'
export type DocStatus = 'draft' | 'open' | 'accepted' | 'rejected' | 'done' | 'paid' | 'cancelled' | 'closed'

export type FieldType = 'text' | 'textarea' | 'number' | 'money' | 'date' | 'select' | 'boolean' | 'image'
export type FieldValue = string | number | boolean | null
export type CustomValues = Record<string, FieldValue>

export interface FieldDef {
  id: string
  key: string
  label: string
  type: FieldType
  required: boolean
  defaultValue: FieldValue
  help: string
  options: string[]
}

export type FieldScope = 'org' | 'customer' | 'contact' | 'catalog' | 'document' | 'position'
export type ProfileId = 'basic' | 'en16931'

export type TaxCategory = 'S' | 'Z' | 'E' | 'AE' | 'K' | 'G'
export interface TaxRate { id: string; label: string; percent: number; category: TaxCategory; exemptionNote: string | null }
export interface Unit { id: string; name: string; symbol: string; decimals: number; code: string }
export interface Category { id: string; name: string }
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
}

export interface CatalogItem {
  id: string
  title: string
  description: string
  categoryId: string | null
  unitId: string
  price: number
  taxRateId: string
  custom: CustomValues
}

export type PositionKind = 'item' | 'heading' | 'text' | 'optional'
export interface Position {
  id: string
  kind: PositionKind
  title: string
  description: string
  quantity: number
  unitId: string | null
  unitPrice: number
  taxRateId: string | null
  categoryId: string | null
  custom: CustomValues
}

export interface NumberState { pattern: string; nextSeq: number; resetYearly: boolean; lastYear: number | null }

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
  documentFields: FieldDef[]
  positionFields: FieldDef[]
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
  positions: Position[]
  custom: CustomValues
  sourceId: string | null
  cancelledById: string | null
  finalizedAt: string | null
  createdAt: string
  updatedAt: string
}

export type ExpectedFieldScope = 'org' | 'customer' | 'contact' | 'document' | 'position'
export interface TemplateManifest {
  name: string
  version: string
  author: string
  license: string
  description: string
  documentTypes: DocType[]
  expectedFields: { scope: ExpectedFieldScope; key: string; type: FieldType; fallback: string }[]
  paper: { format: 'A4' | 'Letter'; margin: string }
}

export interface Template {
  id: string
  builtIn: boolean
  manifest: TemplateManifest
  liquid: string
  css: string
}
