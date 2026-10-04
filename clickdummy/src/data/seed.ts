import { addDays, todayIso } from '@/domain/dates'
import type { CatalogItem, Customer, DocType, DocTypeConfig, Document, FieldDef, Position, Template } from '@/domain/types'
import type { SettingsData } from '@/store/settingsStore'
import { builtInTemplates } from '@/templates'

export interface SeedData { settings: SettingsData; customers: Customer[]; catalog: CatalogItem[]; documents: Document[]; templates: Template[] }

const f = (id: string, key: string, label: string, type: FieldDef['type'], extra: Partial<FieldDef> = {}): FieldDef => ({
  id, key, label, type, required: false, defaultValue: null, help: '', options: [], ...extra,
})

const docType = (type: DocType, label: string, pattern: string, extra: Partial<DocTypeConfig> = {}): DocTypeConfig => ({
  type, label, profile: 'basic', numbering: { pattern, nextSeq: 1, resetYearly: true, lastYear: null },
  templateId: 'tpl-klar', defaultIntroBlockId: null, defaultClosingBlockId: null, paymentTermDays: null, validityDays: null,
  documentFields: [], positionFields: [], ...extra,
})

/** Fiktive Demo-Daten — keine echten Firmen oder Personen. */
export function seed(): SeedData {
  const today = todayIso()
  const year = new Date().getFullYear()
  const projectName = f('fd-project', 'project_name', 'Projektname', 'text')
  const phaseOptions = ['Konzeption', 'Design', 'Umsetzung', 'Betrieb']
  const phase = f('fd-phase', 'phase', 'Projektphase', 'select', { options: phaseOptions })

  const settings: SettingsData = {
    org: {
      name: 'Studio Nordlicht', address: { street: 'Hafenweg 3', zip: '20457', city: 'Hamburg', country: 'DE' }, logo: null,
      vatId: 'DE123456789', taxNumber: '', iban: 'DE02 1203 0000 0000 2020 51', bic: 'BYLADEM1001', bankName: 'Demo Bank',
      email: 'hallo@nordlicht.example', phone: '+49 40 1234567', website: 'nordlicht.example', taxationMode: 'regular',
      custom: { register: 'Amtsgericht Hamburg HRB 000000' },
    },
    docTypes: {
      offer: docType('offer', 'Angebot', 'AN-{YYYY}-{0000}', { validityDays: 30, defaultIntroBlockId: 'tb-offer-intro', defaultClosingBlockId: 'tb-closing', documentFields: [projectName], positionFields: [phase], numbering: { pattern: 'AN-{YYYY}-{0000}', nextSeq: 3, resetYearly: true, lastYear: year } }),
      confirmation: docType('confirmation', 'Auftragsbestätigung', 'AB-{YYYY}-{0000}', { documentFields: [projectName], positionFields: [phase] }),
      invoice: docType('invoice', 'Rechnung', 'RE-{YYYY}-{0000}', { profile: 'en16931', paymentTermDays: 14, defaultIntroBlockId: 'tb-invoice-intro', defaultClosingBlockId: 'tb-payment', documentFields: [projectName], positionFields: [phase], numbering: { pattern: 'RE-{YYYY}-{0000}', nextSeq: 3, resetYearly: true, lastYear: year } }),
      cancellation: docType('cancellation', 'Storno', 'ST-{YYYY}-{0000}', { profile: 'en16931', documentFields: [projectName], positionFields: [phase] }),
    },
    taxRates: [
      { id: 'tax-19', label: '19 %', percent: 19, category: 'S', exemptionNote: null },
      { id: 'tax-7', label: '7 %', percent: 7, category: 'S', exemptionNote: null },
      { id: 'tax-0', label: '0 %', percent: 0, category: 'Z', exemptionNote: null },
    ],
    units: [
      { id: 'u-hour', name: 'Stunde', symbol: 'Std.', decimals: 2, code: 'HUR' },
      { id: 'u-day', name: 'Tag', symbol: 'Tag', decimals: 1, code: 'DAY' },
      { id: 'u-piece', name: 'Stück', symbol: 'Stk.', decimals: 0, code: 'H87' },
      { id: 'u-flat', name: 'Pauschal', symbol: 'psch.', decimals: 0, code: 'LS' },
      { id: 'u-km', name: 'Kilometer', symbol: 'km', decimals: 0, code: 'KMT' },
      { id: 'u-month', name: 'Monat', symbol: 'Mon.', decimals: 0, code: 'MON' },
    ],
    categories: [
      { id: 'cat-consulting', name: 'Beratung' },
      { id: 'cat-design', name: 'Design' },
      { id: 'cat-dev', name: 'Implementierung' },
      { id: 'cat-hosting', name: 'Hosting & Betrieb' },
    ],
    textBlocks: [
      { id: 'tb-offer-intro', name: 'Angebot – Einleitung', kind: 'intro', body: 'Hallo {{ contact.first_name }},\nvielen Dank für das nette Gespräch. Gerne biete ich Ihnen folgende Leistungen an:' },
      { id: 'tb-invoice-intro', name: 'Rechnung – Einleitung', kind: 'intro', body: 'Vielen Dank für die gute Zusammenarbeit. Ich berechne Ihnen folgende Leistungen:' },
      { id: 'tb-payment', name: 'Zahlungsbedingungen', kind: 'payment', body: 'Bitte überweisen Sie den Betrag bis zum {{ document.due_date | date }} auf das unten genannte Konto.' },
      { id: 'tb-closing', name: 'Schlusstext', kind: 'closing', body: 'Ich freue mich auf Ihre Rückmeldung.\nViele Grüße' },
    ],
    users: [
      { id: 'usr-1', name: 'Mara Lindqvist', email: 'mara@nordlicht.example', role: 'owner' },
      { id: 'usr-2', name: 'Jonas Peters', email: 'jonas@nordlicht.example', role: 'member' },
    ],
    fieldDefs: {
      org: [f('fd-register', 'register', 'Handelsregister', 'text')],
      customer: [f('fd-industry', 'industry', 'Branche', 'text')],
      contact: [f('fd-birthday', 'birthday', 'Geburtstag', 'date')],
      catalog: [f('fd-cat-phase', 'phase', 'Projektphase', 'select', { options: phaseOptions })],
    },
  }

  const customers: Customer[] = [
    {
      id: 'cus-bohnenwerk', number: 'K-1001', name: 'Bohnenwerk Kaffeerösterei GmbH',
      address: { street: 'Röstereistraße 12', zip: '10115', city: 'Berlin', country: 'DE' }, email: 'buchhaltung@bohnenwerk.example',
      vatId: 'DE987654321', taxTreatment: 'domestic', custom: { industry: 'Gastronomie' },
      contacts: [
        { id: 'con-ida', salutation: 'Frau', firstName: 'Ida', lastName: 'Brandt', position: 'Geschäftsführerin', email: 'ida@bohnenwerk.example', phone: '', isDefault: true, custom: {} },
        { id: 'con-tom', salutation: 'Herr', firstName: 'Tom', lastName: 'Albers', position: 'Marketing', email: 'tom@bohnenwerk.example', phone: '', isDefault: false, custom: {} },
      ],
    },
    {
      id: 'cus-fjord', number: 'K-1002', name: 'Fjord Analytics AB',
      address: { street: 'Storgatan 8', zip: '111 51', city: 'Stockholm', country: 'SE' }, email: 'invoices@fjord.example',
      vatId: 'SE556677889901', taxTreatment: 'eu_reverse_charge', custom: { industry: 'Software' },
      contacts: [{ id: 'con-elin', salutation: 'Frau', firstName: 'Elin', lastName: 'Berg', position: 'CTO', email: 'elin@fjord.example', phone: '', isDefault: true, custom: {} }],
    },
    {
      id: 'cus-alpen', number: 'K-1003', name: 'Hotel Alpenglück',
      address: { street: 'Bergweg 1', zip: '87561', city: 'Oberstdorf', country: 'DE' }, email: 'info@alpenglueck.example',
      vatId: '', taxTreatment: 'domestic', custom: { industry: 'Hotellerie' },
      contacts: [{ id: 'con-max', salutation: 'Herr', firstName: 'Max', lastName: 'Huber', position: 'Inhaber', email: 'max@alpenglueck.example', phone: '', isDefault: true, custom: {} }],
    },
  ]

  const catalog: CatalogItem[] = [
    { id: 'ci-workshop', title: 'Workshop', description: 'Halbtägiger Workshop inkl. Vorbereitung', categoryId: 'cat-consulting', unitId: 'u-flat', price: 890, taxRateId: 'tax-19', custom: { phase: 'Konzeption' } },
    { id: 'ci-consulting', title: 'Beratung', description: '', categoryId: 'cat-consulting', unitId: 'u-hour', price: 110, taxRateId: 'tax-19', custom: { phase: 'Konzeption' } },
    { id: 'ci-design', title: 'UI-Design', description: 'Screens, Komponenten, Prototyp', categoryId: 'cat-design', unitId: 'u-hour', price: 95, taxRateId: 'tax-19', custom: { phase: 'Design' } },
    { id: 'ci-dev', title: 'Entwicklung', description: '', categoryId: 'cat-dev', unitId: 'u-hour', price: 95, taxRateId: 'tax-19', custom: { phase: 'Umsetzung' } },
    { id: 'ci-hosting', title: 'Hosting & Wartung', description: 'Server, Updates, Monitoring', categoryId: 'cat-hosting', unitId: 'u-month', price: 49, taxRateId: 'tax-19', custom: { phase: 'Betrieb' } },
  ]

  const p = (id: string, over: Partial<Position>): Position => ({
    id, kind: 'item', title: '', description: '', quantity: 1, unitId: 'u-hour', unitPrice: 95, taxRateId: 'tax-19', categoryId: null, custom: {}, ...over,
  })
  const heading = (id: string, title: string) => p(id, { kind: 'heading', title, quantity: 0, unitId: null, unitPrice: 0, taxRateId: null })
  const stamp = (days: number) => `${addDays(today, days)}T09:00:00.000Z`
  const base = { serviceDateEnd: null, sourceId: null, cancelledById: null, templateId: 'tpl-klar', snapshot: null }
  const tb = (id: string) => settings.textBlocks.find((b) => b.id === id)!.body

  const documents: Document[] = [
    {
      ...base, id: 'doc-offer-1', type: 'offer', status: 'accepted', number: `AN-${year}-0001`, date: addDays(today, -40), customerId: 'cus-bohnenwerk', contactId: 'con-ida',
      serviceDate: null, dueDate: null, validUntil: addDays(today, -10), intro: tb('tb-offer-intro'), closing: tb('tb-closing'),
      custom: { project_name: 'Shop-Relaunch' }, finalizedAt: stamp(-40), createdAt: stamp(-41), updatedAt: stamp(-35),
      positions: [
        heading('d1-h1', 'Konzeption'),
        p('d1-a', { title: 'Workshop', description: 'Halbtägiger Workshop inkl. Vorbereitung', unitId: 'u-flat', unitPrice: 890, categoryId: 'cat-consulting', custom: { phase: 'Konzeption' } }),
        heading('d1-h2', 'Umsetzung'),
        p('d1-b', { title: 'UI-Design', description: 'Screens, Komponenten, Prototyp', quantity: 24, categoryId: 'cat-design', custom: { phase: 'Design' } }),
        p('d1-c', { title: 'Entwicklung', quantity: 60, categoryId: 'cat-dev', custom: { phase: 'Umsetzung' } }),
        p('d1-t', { kind: 'text', title: 'Inklusive zwei Korrekturschleifen.', quantity: 0, unitId: null, unitPrice: 0, taxRateId: null }),
        p('d1-o', { kind: 'optional', title: 'Hosting & Wartung', description: 'Server, Updates, Monitoring', unitId: 'u-month', quantity: 12, unitPrice: 49, categoryId: 'cat-hosting', custom: { phase: 'Betrieb' } }),
      ],
    },
    {
      ...base, id: 'doc-offer-2', type: 'offer', status: 'open', number: `AN-${year}-0002`, date: addDays(today, -6), customerId: 'cus-fjord', contactId: 'con-elin',
      serviceDate: null, dueDate: null, validUntil: addDays(today, 24), intro: tb('tb-offer-intro'), closing: tb('tb-closing'),
      custom: { project_name: 'Dashboard-Audit' }, finalizedAt: stamp(-6), createdAt: stamp(-7), updatedAt: stamp(-6),
      positions: [p('d2-a', { title: 'Beratung', quantity: 16, unitPrice: 110, categoryId: 'cat-consulting', custom: { phase: 'Konzeption' } })],
    },
    {
      ...base, id: 'doc-invoice-1', type: 'invoice', status: 'open', number: `RE-${year}-0001`, date: addDays(today, -20), customerId: 'cus-fjord', contactId: 'con-elin',
      serviceDate: addDays(today, -22), dueDate: addDays(today, -6), validUntil: null, intro: tb('tb-invoice-intro'), closing: tb('tb-payment'),
      custom: { project_name: 'Datenmodell' }, finalizedAt: stamp(-20), createdAt: stamp(-21), updatedAt: stamp(-20),
      positions: [p('d3-a', { title: 'Beratung', quantity: 12, unitPrice: 110, categoryId: 'cat-consulting', custom: { phase: 'Konzeption' } })],
    },
    {
      ...base, id: 'doc-invoice-2', type: 'invoice', status: 'paid', number: `RE-${year}-0002`, date: addDays(today, -12), customerId: 'cus-alpen', contactId: 'con-max',
      serviceDate: addDays(today, -14), dueDate: addDays(today, 2), validUntil: null, intro: tb('tb-invoice-intro'), closing: tb('tb-payment'),
      custom: { project_name: 'Buchungsstrecke' }, finalizedAt: stamp(-12), createdAt: stamp(-13), updatedAt: stamp(-3),
      positions: [
        p('d4-a', { title: 'Entwicklung', quantity: 18, categoryId: 'cat-dev', custom: { phase: 'Umsetzung' } }),
        p('d4-b', { title: 'Hosting & Wartung', unitId: 'u-month', quantity: 1, unitPrice: 49, categoryId: 'cat-hosting', custom: { phase: 'Betrieb' } }),
      ],
    },
    {
      ...base, id: 'doc-offer-3', type: 'offer', status: 'draft', number: null, date: today, customerId: 'cus-alpen', contactId: 'con-max',
      serviceDate: null, dueDate: null, validUntil: addDays(today, 30), intro: tb('tb-offer-intro'), closing: tb('tb-closing'),
      custom: { project_name: 'Newsletter' }, finalizedAt: null, createdAt: stamp(0), updatedAt: stamp(0),
      positions: [p('d5-a', { title: 'UI-Design', description: 'Newsletter-Vorlage', quantity: 8, categoryId: 'cat-design', custom: { phase: 'Design' } })],
    },
  ]

  for (const d of documents) {
    if (d.status !== 'draft') {
      d.snapshot = { org: settings.org, taxRates: settings.taxRates, units: settings.units, categories: settings.categories, customer: customers.find((c) => c.id === d.customerId) ?? null }
    }
  }

  return { settings, customers, catalog, documents, templates: builtInTemplates }
}
