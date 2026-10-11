import { addDays, todayIso } from '@/domain/dates'
import type { Customer, DocType, DocTypeConfig, Document, FieldDef, Position, PositionGroup, Settings, Template } from '@/domain/types'
import { builtInTemplates } from '@/templates'

export interface Db {
  version: number
  settings: Settings
  customers: Customer[]
  documents: Document[]
  templates: Template[]
}

export const DB_VERSION = 2

const field = (id: string, scope: FieldDef['scope'], key: string, label: string, type: FieldDef['type'], extra: Partial<FieldDef> = {}): FieldDef => ({
  id, scope, key, label, type, required: false, defaultValue: null, help: '', options: [], docTypes: [], ...extra,
})

const docType = (type: DocType, label: string, pattern: string, extra: Partial<DocTypeConfig> = {}): DocTypeConfig => ({
  type, label, profile: 'basic', numbering: { pattern, nextSeq: 1, resetYearly: true, lastYear: null },
  templateId: 'tpl-klar', defaultIntroBlockId: null, defaultClosingBlockId: null, paymentTermDays: null, validityDays: null, ...extra,
})

/** Fiktive Demo-Daten: keine echten Firmen oder Personen. */
export function seed(): Db {
  const today = todayIso()
  const year = new Date().getFullYear()
  const all: DocType[] = ['offer', 'confirmation', 'invoice', 'cancellation']

  const settings: Settings = {
    org: {
      name: 'Studio Nordlicht', address: { street: 'Speicherstraße 12', zip: '20457', city: 'Hamburg', country: 'DE' }, logo: null,
      vatId: 'DE123456789', taxNumber: '', iban: 'DE02 1203 0000 0000 2020 51', bic: 'BYLADEM1001', bankName: 'Demo Bank',
      email: 'hallo@nordlicht.example', phone: '+49 40 1234567', website: 'nordlicht.example', taxationMode: 'regular',
      custom: { register: 'Amtsgericht Hamburg HRB 000000' },
    },
    docTypes: {
      offer: docType('offer', 'Angebot', 'AN-{YYYY}-{0000}', { validityDays: 30, defaultIntroBlockId: 'tb-offer-intro', defaultClosingBlockId: 'tb-closing', numbering: { pattern: 'AN-{YYYY}-{0000}', nextSeq: 4, resetYearly: true, lastYear: year } }),
      confirmation: docType('confirmation', 'Auftragsbestätigung', 'AB-{YYYY}-{0000}', { templateId: 'tpl-leise' }),
      invoice: docType('invoice', 'Rechnung', 'RE-{YYYY}-{0000}', { profile: 'en16931', paymentTermDays: 14, defaultIntroBlockId: 'tb-invoice-intro', defaultClosingBlockId: 'tb-payment', numbering: { pattern: 'RE-{YYYY}-{0000}', nextSeq: 43, resetYearly: true, lastYear: year } }),
      cancellation: docType('cancellation', 'Storno', 'ST-{YYYY}-{0000}', { profile: 'en16931' }),
    },
    taxRates: [
      { id: 'tax-19', label: '19 %', percent: 19, category: 'S', exemptionNote: null },
      { id: 'tax-7', label: '7 %', percent: 7, category: 'S', exemptionNote: null },
      { id: 'tax-0', label: '0 %', percent: 0, category: 'Z', exemptionNote: null },
    ],
    units: [
      { id: 'u-hour', name: 'Stunde', symbol: 'Std.', decimals: 2, code: 'HUR' },
      { id: 'u-day', name: 'Tag', symbol: 'Tage', decimals: 1, code: 'DAY' },
      { id: 'u-piece', name: 'Stück', symbol: 'Stk.', decimals: 0, code: 'H87' },
      { id: 'u-flat', name: 'Pauschal', symbol: 'Psch.', decimals: 0, code: 'LS' },
      { id: 'u-month', name: 'Monat', symbol: 'Mon.', decimals: 0, code: 'MON' },
    ],
    textBlocks: [
      { id: 'tb-offer-intro', name: 'Angebot: Einleitung', kind: 'intro', body: 'Hallo {{ contact.first_name }},\nvielen Dank für das gute Gespräch. Wie besprochen biete ich Ihnen folgende Leistungen an:' },
      { id: 'tb-invoice-intro', name: 'Rechnung: Einleitung', kind: 'intro', body: 'Vielen Dank für die gute Zusammenarbeit. Für das Projekt berechne ich Ihnen folgende Leistungen:' },
      { id: 'tb-payment', name: 'Zahlungsbedingungen', kind: 'payment', body: 'Bitte überweisen Sie den Betrag bis zum {{ document.due_date | date }} auf das unten genannte Konto.' },
      { id: 'tb-closing', name: 'Schlusstext', kind: 'closing', body: 'Ich freue mich auf Ihre Rückmeldung.\nViele Grüße\nKai Behrens' },
    ],
    users: [
      { id: 'usr-1', name: 'Kai Behrens', email: 'kai@nordlicht.example', role: 'owner' },
      { id: 'usr-2', name: 'Lena Voss', email: 'lena@nordlicht.example', role: 'member' },
    ],
    fieldDefs: [
      field('fd-register', 'org', 'register', 'Handelsregister', 'text'),
      field('fd-industry', 'customer', 'industry', 'Branche', 'select', { options: ['Handel', 'Software', 'Hotellerie', 'Logistik', 'Kultur'] }),
      field('fd-supplier-no', 'customer', 'supplier_number', 'Unsere Lieferantennummer', 'text', { help: 'Die Nummer, unter der uns der Kunde führt.' }),
      field('fd-department', 'contact', 'department', 'Abteilung', 'text'),
      field('fd-project', 'document', 'project_name', 'Projektname', 'text', { docTypes: all }),
      field('fd-po', 'document', 'po_number', 'Bestellnummer des Kunden', 'text', { docTypes: ['confirmation', 'invoice'], help: 'Steht auf der Bestellung des Kunden und muss auf die Rechnung.' }),
      field('fd-sla', 'document', 'response_time', 'Reaktionszeit', 'select', { docTypes: ['offer', 'confirmation'], options: ['24 Stunden', '48 Stunden', 'nächster Werktag'] }),
      field('fd-ticket', 'position', 'ticket', 'Ticket', 'text', { docTypes: ['invoice', 'cancellation'], help: 'Referenz aus dem Ticketsystem, z. B. SHOP-142.' }),
    ],
  }

  const customers: Customer[] = [
    {
      id: 'cus-hafenkontor', number: 'K-1001', name: 'Hafenkontor Lindqvist GmbH', createdAt: `${addDays(today, -220)}T09:00:00.000Z`,
      address: { street: 'Am Sandtorkai 4', zip: '20457', city: 'Hamburg', country: 'DE' }, email: 'buchhaltung@hafenkontor.example',
      vatId: 'DE987654321', taxTreatment: 'domestic', custom: { industry: 'Handel', supplier_number: 'L-20931' },
      contacts: [
        { id: 'con-mira', salutation: 'Frau', firstName: 'Mira', lastName: 'Albers', position: 'Leitung E-Commerce', email: 'mira.albers@hafenkontor.example', phone: '+49 40 555 0101', isDefault: true, custom: { department: 'Digital' } },
        { id: 'con-ole', salutation: 'Herr', firstName: 'Ole', lastName: 'Brandt', position: 'Einkauf', email: 'ole.brandt@hafenkontor.example', phone: '', isDefault: false, custom: { department: 'Einkauf' } },
      ],
    },
    {
      id: 'cus-fjord', number: 'K-1002', name: 'Fjord Analytics AB', createdAt: `${addDays(today, -160)}T09:00:00.000Z`,
      address: { street: 'Storgatan 8', zip: '111 51', city: 'Stockholm', country: 'SE' }, email: 'invoices@fjord.example',
      vatId: 'SE556677889901', taxTreatment: 'eu_reverse_charge', custom: { industry: 'Software' },
      contacts: [{ id: 'con-elin', salutation: 'Frau', firstName: 'Elin', lastName: 'Berg', position: 'CTO', email: 'elin@fjord.example', phone: '', isDefault: true, custom: {} }],
    },
    {
      id: 'cus-alpen', number: 'K-1003', name: 'Hotel Alpenglück', createdAt: `${addDays(today, -90)}T09:00:00.000Z`,
      address: { street: 'Bergweg 1', zip: '87561', city: 'Oberstdorf', country: 'DE' }, email: 'info@alpenglueck.example',
      vatId: '', taxTreatment: 'domestic', custom: { industry: 'Hotellerie' },
      contacts: [{ id: 'con-max', salutation: 'Herr', firstName: 'Max', lastName: 'Huber', position: 'Inhaber', email: 'max@alpenglueck.example', phone: '+49 8322 555 22', isDefault: true, custom: {} }],
    },
    {
      id: 'cus-kulturwerk', number: 'K-1004', name: 'Kulturwerk Elbinsel e. V.', createdAt: `${addDays(today, -30)}T09:00:00.000Z`,
      address: { street: 'Veringstraße 40', zip: '21107', city: 'Hamburg', country: 'DE' }, email: 'vorstand@kulturwerk.example',
      vatId: '', taxTreatment: 'domestic', custom: { industry: 'Kultur' },
      contacts: [{ id: 'con-jana', salutation: 'Frau', firstName: 'Jana', lastName: 'Okafor', position: 'Vorstand', email: 'jana@kulturwerk.example', phone: '', isDefault: true, custom: {} }],
    },
  ]

  let pid = 0
  const p = (over: Partial<Position>): Position => ({
    id: `pos-${++pid}`, kind: 'item', title: '', description: '', quantity: 1, unitId: 'u-hour', unitPrice: 95, taxRateId: 'tax-19', custom: {}, ...over,
  })
  const g = (id: string, title: string | null, positions: Position[]): PositionGroup => ({ id, title, positions })
  const stamp = (days: number) => `${addDays(today, days)}T09:00:00.000Z`
  const base = { serviceDateEnd: null, sourceId: null, cancelledById: null, templateId: 'tpl-klar', snapshot: null }
  const tb = (id: string) => settings.textBlocks.find((b) => b.id === id)!.body

  const shopGroups = (prefix: string): PositionGroup[] => [
    g(`${prefix}-g1`, 'Konzept & UX', [
      p({ title: 'Discovery-Workshop', description: 'Halbtags vor Ort, inklusive Protokoll', unitId: 'u-flat', unitPrice: 890 }),
      p({ title: 'Wireframes & Klickpfade', quantity: 3, unitId: 'u-day', unitPrice: 760 }),
    ]),
    g(`${prefix}-g2`, 'Umsetzung', [
      p({ title: 'Frontend-Entwicklung', description: 'Shop-Theme, Warenkorb, Checkout', quantity: 52 }),
      p({ kind: 'text', title: 'Inklusive zwei Korrekturschleifen.', quantity: 0, unitId: null, unitPrice: 0, taxRateId: null }),
    ]),
    g(`${prefix}-g3`, 'Betrieb', [
      p({ kind: 'optional', title: 'Wartung & Updates', description: 'Monatlich, inklusive Monitoring', unitId: 'u-month', quantity: 12, unitPrice: 149 }),
    ]),
  ]

  const documents: Document[] = [
    {
      ...base, id: 'doc-an-1', type: 'offer', status: 'accepted', number: `AN-${year}-0001`, date: addDays(today, -48), customerId: 'cus-hafenkontor', contactId: 'con-mira',
      serviceDate: null, dueDate: null, validUntil: addDays(today, -18), intro: tb('tb-offer-intro'), closing: tb('tb-closing'),
      custom: { project_name: 'Relaunch Online-Shop', response_time: '48 Stunden' }, finalizedAt: stamp(-48), createdAt: stamp(-49), updatedAt: stamp(-40),
      groups: shopGroups('an1'),
    },
    {
      ...base, id: 'doc-re-42', type: 'invoice', status: 'draft', number: null, date: today, customerId: 'cus-hafenkontor', contactId: 'con-mira',
      serviceDate: null, dueDate: addDays(today, 14), validUntil: null, intro: tb('tb-invoice-intro'), closing: tb('tb-payment'), sourceId: 'doc-an-1',
      custom: { project_name: 'Relaunch Online-Shop', po_number: 'PO-77812' }, finalizedAt: null, createdAt: stamp(-1), updatedAt: stamp(0),
      groups: shopGroups('re42').slice(0, 2).map((gr) => ({ ...gr, positions: gr.positions.map((x) => ({ ...x, id: `${x.id}-re`, custom: (x.kind === 'item' ? { ticket: 'SHOP-142' } : {}) as Position['custom'] })) })),
    },
    {
      ...base, id: 'doc-an-2', type: 'offer', status: 'open', number: `AN-${year}-0002`, date: addDays(today, -6), customerId: 'cus-fjord', contactId: 'con-elin',
      serviceDate: null, dueDate: null, validUntil: addDays(today, 24), intro: tb('tb-offer-intro'), closing: tb('tb-closing'), templateId: 'tpl-kante',
      custom: { project_name: 'Dashboard-Audit' }, finalizedAt: stamp(-6), createdAt: stamp(-7), updatedAt: stamp(-6),
      groups: [g('an2-g0', null, [p({ title: 'UX-Audit Analytics-Dashboard', description: 'Heuristische Analyse, Bericht mit Empfehlungen', quantity: 16, unitPrice: 110 })])],
    },
    {
      ...base, id: 'doc-an-3', type: 'offer', status: 'open', number: `AN-${year}-0003`, date: addDays(today, -3), customerId: 'cus-kulturwerk', contactId: 'con-jana',
      serviceDate: null, dueDate: null, validUntil: addDays(today, 27), intro: tb('tb-offer-intro'), closing: tb('tb-closing'),
      custom: { project_name: 'Festival-Website 2027' }, finalizedAt: stamp(-3), createdAt: stamp(-4), updatedAt: stamp(-3),
      groups: [
        g('an3-g1', 'Gestaltung', [p({ title: 'Designsystem & Startseite', quantity: 4, unitId: 'u-day', unitPrice: 720 })]),
        g('an3-g2', 'Umsetzung', [p({ title: 'Programmübersicht mit Filter', quantity: 28 }), p({ title: 'Ticket-Anbindung', quantity: 12 })]),
      ],
    },
    {
      ...base, id: 'doc-re-40', type: 'invoice', status: 'open', number: `RE-${year}-0040`, date: addDays(today, -24), customerId: 'cus-fjord', contactId: 'con-elin',
      serviceDate: addDays(today, -26), dueDate: addDays(today, -10), validUntil: null, intro: tb('tb-invoice-intro'), closing: tb('tb-payment'),
      custom: { project_name: 'Datenmodell' }, finalizedAt: stamp(-24), createdAt: stamp(-25), updatedAt: stamp(-24),
      groups: [g('re40-g0', null, [p({ title: 'Beratung Datenmodell', quantity: 12, unitPrice: 110 })])],
    },
    {
      ...base, id: 'doc-re-41', type: 'invoice', status: 'paid', number: `RE-${year}-0041`, date: addDays(today, -15), customerId: 'cus-alpen', contactId: 'con-max',
      serviceDate: addDays(today, -17), dueDate: addDays(today, -1), validUntil: null, intro: tb('tb-invoice-intro'), closing: tb('tb-payment'),
      custom: { project_name: 'Buchungsstrecke' }, paidAt: stamp(-4), finalizedAt: stamp(-15), createdAt: stamp(-16), updatedAt: stamp(-4),
      groups: [
        g('re41-g1', 'Entwicklung', [p({ title: 'Buchungsstrecke mobil', quantity: 18 }), p({ title: 'Anbindung Channel-Manager', quantity: 6 })]),
        g('re41-g2', 'Betrieb', [p({ title: 'Hosting', unitId: 'u-month', quantity: 1, unitPrice: 49 })]),
      ],
    },
    {
      ...base, id: 'doc-ab-1', type: 'confirmation', status: 'open', number: `AB-${year}-0001`, date: addDays(today, -40), customerId: 'cus-hafenkontor', contactId: 'con-mira',
      serviceDate: null, dueDate: null, validUntil: null, intro: 'Vielen Dank für Ihren Auftrag. Hiermit bestätige ich die folgenden Leistungen:', closing: tb('tb-closing'),
      sourceId: 'doc-an-1', templateId: 'tpl-leise',
      custom: { project_name: 'Relaunch Online-Shop', po_number: 'PO-77812', response_time: '48 Stunden' }, finalizedAt: stamp(-40), createdAt: stamp(-40), updatedAt: stamp(-40),
      groups: shopGroups('ab1').slice(0, 2),
    },
    {
      ...base, id: 'doc-an-4', type: 'offer', status: 'draft', number: null, date: today, customerId: 'cus-alpen', contactId: 'con-max',
      serviceDate: null, dueDate: null, validUntil: addDays(today, 30), intro: tb('tb-offer-intro'), closing: tb('tb-closing'),
      custom: { project_name: 'Newsletter' }, finalizedAt: null, createdAt: stamp(-2), updatedAt: stamp(-2),
      groups: [g('an4-g0', null, [p({ title: 'Newsletter-Vorlage', description: 'Gestaltung und Umsetzung, responsiv', quantity: 8 })])],
    },
  ]

  for (const d of documents) {
    if (d.status !== 'draft') {
      d.snapshot = { org: settings.org, taxRates: settings.taxRates, units: settings.units, customer: customers.find((c) => c.id === d.customerId) ?? null }
    }
  }

  return { version: DB_VERSION, settings, customers, documents, templates: builtInTemplates }
}
