import { canConvert, convertDocument } from '@/domain/convert'
import { addDays, todayIso } from '@/domain/dates'
import { buildDocumentView, documentTotals } from '@/domain/documentView'
import { defaultCustomValues, fieldsFor } from '@/domain/fields'
import { canTransition, isLocked, isOverdue } from '@/domain/lifecycle'
import { allPositions, type DocStatus, type DocType, type Document, type Position } from '@/domain/types'
import { ApiError, clone, db, latency, maybeFail, newId, nowIso, persist, resetDb } from './db'
import { takeNumber } from './settings'

/** Listeneintrag mit den Werten, die Liste und Übersicht brauchen. */
export interface DocumentSummary {
  id: string
  type: DocType
  status: DocStatus
  number: string | null
  date: string
  dueDate: string | null
  validUntil: string | null
  customerId: string | null
  customerName: string
  projectName: string | null
  gross: number
  overdue: boolean
  paidAt: string | null
  updatedAt: string
}

export interface DocumentFilter {
  type?: DocType
  status?: DocStatus | 'overdue'
  customerId?: string
  query?: string
}

function summarize(d: Document): DocumentSummary {
  const totals = documentTotals(d, db.settings, db.customers)
  const customer = (d.snapshot?.customer ?? db.customers.find((c) => c.id === d.customerId)) || null
  return {
    id: d.id, type: d.type, status: d.status, number: d.number, date: d.date, dueDate: d.dueDate, validUntil: d.validUntil,
    customerId: d.customerId, customerName: customer?.name ?? 'Ohne Kunde',
    projectName: typeof d.custom.project_name === 'string' && d.custom.project_name ? d.custom.project_name : null,
    gross: totals.gross, overdue: isOverdue(d, todayIso()), paidAt: d.paidAt ?? null, updatedAt: d.updatedAt,
  }
}

export async function listDocuments(filter: DocumentFilter = {}): Promise<DocumentSummary[]> {
  await latency()
  maybeFail()
  const q = filter.query?.trim().toLowerCase()
  return db.documents
    .map(summarize)
    .filter((s) => !filter.type || s.type === filter.type)
    .filter((s) => !filter.status || (filter.status === 'overdue' ? s.overdue : s.status === filter.status))
    .filter((s) => !filter.customerId || s.customerId === filter.customerId)
    .filter((s) => !q || [s.number, s.customerName, s.projectName].join(' ').toLowerCase().includes(q))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getDocument(id: string): Promise<Document> {
  await latency()
  maybeFail()
  return clone(find(id))
}

function find(id: string): Document {
  const d = db.documents.find((x) => x.id === id)
  if (!d) throw new ApiError('Dieses Dokument gibt es nicht mehr.')
  return d
}

function replace(doc: Document) {
  db.documents = db.documents.map((d) => (d.id === doc.id ? doc : d))
}

export async function createDocument(input: { type: DocType; customerId: string | null }): Promise<Document> {
  await latency()
  maybeFail()
  const { type, customerId } = input
  const config = db.settings.docTypes[type]
  const block = (bid: string | null) => db.settings.textBlocks.find((b) => b.id === bid)?.body ?? ''
  const customer = db.customers.find((c) => c.id === customerId)
  const date = todayIso()
  const doc: Document = {
    id: newId('doc'), type, status: 'draft', number: null, date, customerId,
    contactId: customer?.contacts.find((c) => c.isDefault)?.id ?? null,
    serviceDate: type === 'invoice' ? date : null, serviceDateEnd: null,
    dueDate: type === 'invoice' && config.paymentTermDays !== null ? addDays(date, config.paymentTermDays) : null,
    validUntil: type === 'offer' && config.validityDays !== null ? addDays(date, config.validityDays) : null,
    intro: block(config.defaultIntroBlockId), closing: block(config.defaultClosingBlockId),
    templateId: config.templateId, groups: [{ id: newId('grp'), title: null, positions: [] }],
    custom: defaultCustomValues(fieldsFor(db.settings.fieldDefs, 'document', type)),
    sourceId: null, cancelledById: null, finalizedAt: null, snapshot: null, createdAt: nowIso(), updatedAt: nowIso(),
  }
  db.documents = [doc, ...db.documents]
  persist()
  return clone(doc)
}

/** Speichert einen Entwurf. Abgeschlossene Dokumente sind gesperrt (GoBD). */
export async function updateDocument(doc: Document): Promise<Document> {
  await latency(80)
  maybeFail()
  const current = find(doc.id)
  if (isLocked(current)) throw new ApiError(`${current.number} ist abgeschlossen und lässt sich nicht mehr ändern.`)
  const next = { ...doc, type: current.type, status: current.status, number: null, updatedAt: nowIso() }
  replace(next)
  persist()
  return clone(next)
}

export async function deleteDocument(id: string): Promise<void> {
  await latency()
  maybeFail()
  if (isLocked(find(id))) throw new ApiError('Abgeschlossene Dokumente lassen sich nicht löschen. Rechnungen korrigierst du mit einem Storno.')
  db.documents = db.documents.filter((d) => d.id !== id)
  persist()
}

/** Stellt ein gelöschtes Dokument wieder her (Undo). */
export async function restoreDocument(doc: Document): Promise<Document> {
  await latency(80)
  db.documents = [doc, ...db.documents.filter((d) => d.id !== doc.id)]
  persist()
  return clone(doc)
}

export async function duplicateDocument(id: string): Promise<Document> {
  await latency()
  maybeFail()
  const src = find(id)
  if (src.type === 'cancellation') throw new ApiError('Stornos entstehen nur aus einer Rechnung.')
  const copy: Document = {
    ...clone(src), id: newId('doc'), status: 'draft', number: null, date: todayIso(), sourceId: null, cancelledById: null, finalizedAt: null, snapshot: null,
    groups: src.groups.map((g) => ({ ...clone(g), id: newId('grp'), positions: g.positions.map((p) => ({ ...clone(p), id: newId('pos') })) })),
    createdAt: nowIso(), updatedAt: nowIso(),
  }
  db.documents = [copy, ...db.documents]
  persist()
  return clone(copy)
}

/** Vergibt die Nummer, friert die Stammdaten ein und sperrt das Dokument. Ein Storno setzt seine Rechnung auf „Storniert“. */
export async function finalizeDocument(id: string): Promise<Document> {
  await latency(500)
  maybeFail()
  const doc = find(id)
  if (doc.status !== 'draft') return clone(doc)
  const { issues } = buildDocumentView(doc, db.settings, db.customers, db.documents)
  if (issues.length) throw new ApiError(issues.length === 1 ? '1 Pflichtangabe fehlt.' : `${issues.length} Pflichtangaben fehlen.`, issues)
  const finalizedAt = nowIso()
  const next: Document = {
    ...doc,
    number: takeNumber(doc.type, doc.date),
    status: doc.type === 'cancellation' ? 'closed' : 'open',
    finalizedAt,
    snapshot: { org: clone(db.settings.org), taxRates: clone(db.settings.taxRates), units: clone(db.settings.units), customer: clone(db.customers.find((c) => c.id === doc.customerId) ?? null) },
    updatedAt: finalizedAt,
  }
  replace(next)
  if (doc.type === 'cancellation' && doc.sourceId) {
    const inv = find(doc.sourceId)
    replace({ ...inv, status: 'cancelled', cancelledById: id, updatedAt: finalizedAt })
  }
  persist()
  return clone(next)
}

export async function setDocumentStatus(id: string, status: DocStatus): Promise<Document> {
  await latency()
  maybeFail()
  const doc = find(id)
  if (doc.status === 'draft' || !canTransition(doc.type, doc.status, status)) throw new ApiError('Dieser Statuswechsel ist nicht möglich.')
  const next = { ...doc, status, paidAt: status === 'paid' ? nowIso() : doc.paidAt ?? null, updatedAt: nowIso() }
  replace(next)
  persist()
  return clone(next)
}

export async function convertDocumentTo(id: string, target: DocType): Promise<{ document: Document; droppedFields: string[] }> {
  await latency(400)
  maybeFail()
  const source = find(id)
  if (!canConvert(source, target)) throw new ApiError('Diese Umwandlung ist im aktuellen Status nicht möglich.')
  // Ein offener Storno-Entwurf zählt schon als Storno: kein zweiter.
  if (target === 'cancellation') {
    const existing = db.documents.find((d) => d.sourceId === id && d.type === 'cancellation')
    if (existing) return { document: clone(existing), droppedFields: [] }
  }
  const result = convertDocument(source, target, {
    targetConfig: db.settings.docTypes[target], fieldDefs: db.settings.fieldDefs, today: todayIso(), now: nowIso(), newId: () => newId('x'),
  })
  db.documents = [result.document, ...db.documents]
  persist()
  return clone(result)
}

/** Kette eines Dokuments: Herkunft und daraus entstandene Dokumente. */
export async function getDocumentChain(id: string): Promise<Pick<DocumentSummary, 'id' | 'type' | 'status' | 'number'>[]> {
  await latency(60)
  const pick = (d: Document) => ({ id: d.id, type: d.type, status: d.status, number: d.number })
  const chain: Document[] = []
  let cur: Document | undefined = find(id)
  while (cur?.sourceId) {
    cur = db.documents.find((d) => d.id === cur!.sourceId)
    if (cur) chain.unshift(cur)
  }
  const children = (pid: string): Document[] => db.documents.filter((d) => d.sourceId === pid).flatMap((d) => [d, ...children(d.id)])
  return [...chain, find(id), ...children(id)].map(pick)
}

export interface PositionSuggestion { title: string; description: string; unitId: string | null; unitPrice: number; taxRateId: string | null; usedCount: number; lastUsed: string }

/** Ersatz für den Katalog: Positionen aus früheren Dokumenten, nach Häufigkeit sortiert. */
export async function listPositionSuggestions(): Promise<PositionSuggestion[]> {
  await latency(60)
  const map = new Map<string, PositionSuggestion>()
  for (const d of [...db.documents].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const p of allPositions(d).filter((x: Position) => x.kind !== 'text' && x.title.trim())) {
      const key = p.title.trim().toLowerCase()
      const prev = map.get(key)
      map.set(key, { title: p.title, description: p.description, unitId: p.unitId, unitPrice: Math.abs(p.unitPrice), taxRateId: p.taxRateId, usedCount: (prev?.usedCount ?? 0) + 1, lastUsed: d.date })
    }
  }
  return [...map.values()].sort((a, b) => b.usedCount - a.usedCount || b.lastUsed.localeCompare(a.lastUsed))
}

export async function resetDemo(): Promise<void> {
  await latency(300)
  resetDb()
}
