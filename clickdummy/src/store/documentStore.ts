import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { mergeOrSeed } from './persistence'
import { seed } from '@/data/seed'
import { checkCompliance, type ComplianceContext, type ComplianceIssue } from '@/domain/compliance'
import { canConvert, convertDocument } from '@/domain/convert'
import { addDays, todayIso } from '@/domain/dates'
import { defaultCustomValues } from '@/domain/fields'
import { canTransition, isLocked } from '@/domain/lifecycle'
import type { CatalogItem, DocStatus, DocType, Document, DocumentSnapshot, Position, PositionKind } from '@/domain/types'
import { useCustomerStore } from './customerStore'
import { newId } from './ids'
import { useSettingsStore } from './settingsStore'

interface DocumentState {
  documents: Document[]
  createDocument(type: DocType, customerId?: string | null): string
  updateDocument(id: string, patch: Partial<Document>): void
  addPosition(id: string, kind: PositionKind, afterIndex?: number): string
  insertCatalogItem(id: string, item: CatalogItem, positionId?: string): void
  updatePosition(id: string, positionId: string, patch: Partial<Position>): void
  removePosition(id: string, positionId: string): void
  movePosition(id: string, from: number, to: number): void
  finalizeDocument(id: string): { ok: true } | { ok: false; issues: ComplianceIssue[] }
  setStatus(id: string, status: DocStatus): void
  convertTo(id: string, target: DocType): { id: string; droppedFields: string[] }
  duplicateDocument(id: string): string
  deleteDraft(id: string): void
}

const nowIso = () => new Date().toISOString()
const isPriced = (kind: PositionKind) => kind === 'item' || kind === 'optional'

/** Hält die Stammdaten fest, die ein abgeschlossenes Dokument braucht. */
export function takeSnapshot(customerId: string | null): DocumentSnapshot {
  const s = useSettingsStore.getState()
  return {
    org: s.org, taxRates: s.taxRates, units: s.units, categories: s.categories,
    customer: useCustomerStore.getState().customers.find((c) => c.id === customerId) ?? null,
  }
}

export function buildComplianceContextFor(doc: Document): ComplianceContext {
  const s = useSettingsStore.getState()
  return {
    doc, config: s.docTypes[doc.type], org: s.org,
    customer: useCustomerStore.getState().customers.find((c) => c.id === doc.customerId) ?? null,
    units: s.units, taxRates: s.taxRates, orgFields: s.fieldDefs.org, customerFields: s.fieldDefs.customer,
  }
}

export const useDocumentStore = create<DocumentState>()(
  persist(
    (set, get) => {
      const find = (id: string) => {
        const doc = get().documents.find((d) => d.id === id)
        if (!doc) throw new Error(`Dokument ${id} nicht gefunden`)
        return doc
      }
      const replace = (doc: Document) => set((s) => ({ documents: s.documents.map((d) => (d.id === doc.id ? doc : d)) }))
      /** Ändert nur Entwürfe; abgeschlossene Dokumente bleiben unangetastet (GoBD). */
      const mutateDraft = (id: string, fn: (doc: Document) => Document) => {
        const doc = find(id)
        if (isLocked(doc)) {
          console.warn(`Dokument ${doc.number} ist abgeschlossen und kann nicht geändert werden.`)
          return
        }
        replace({ ...fn(doc), updatedAt: nowIso() })
      }
      const emptyPosition = (kind: PositionKind, type: DocType): Position => {
        const s = useSettingsStore.getState()
        return {
          id: newId(), kind, title: '', description: '', quantity: isPriced(kind) ? 1 : 0,
          unitId: isPriced(kind) ? (s.units[0]?.id ?? null) : null, unitPrice: 0,
          taxRateId: isPriced(kind) ? (s.taxRates[0]?.id ?? null) : null,
          categoryId: null, custom: isPriced(kind) ? defaultCustomValues(s.docTypes[type].positionFields) : {},
        }
      }

      return {
        documents: seed().documents,

        createDocument: (type, customerId = null) => {
          const settings = useSettingsStore.getState()
          const config = settings.docTypes[type]
          const block = (bid: string | null) => settings.textBlocks.find((b) => b.id === bid)?.body ?? ''
          const customer = useCustomerStore.getState().customers.find((c) => c.id === customerId)
          const date = todayIso()
          const doc: Document = {
            id: newId(), type, status: 'draft', number: null, date, customerId,
            contactId: customer?.contacts.find((c) => c.isDefault)?.id ?? null,
            serviceDate: type === 'invoice' ? date : null, serviceDateEnd: null,
            dueDate: type === 'invoice' && config.paymentTermDays !== null ? addDays(date, config.paymentTermDays) : null,
            validUntil: type === 'offer' && config.validityDays !== null ? addDays(date, config.validityDays) : null,
            intro: block(config.defaultIntroBlockId), closing: block(config.defaultClosingBlockId),
            templateId: config.templateId, positions: [], custom: defaultCustomValues(config.documentFields),
            sourceId: null, cancelledById: null, finalizedAt: null, snapshot: null, createdAt: nowIso(), updatedAt: nowIso(),
          }
          set((s) => ({ documents: [doc, ...s.documents] }))
          return doc.id
        },

        updateDocument: (id, patch) => mutateDraft(id, (d) => ({ ...d, ...patch })),

        addPosition: (id, kind, afterIndex) => {
          const position = emptyPosition(kind, find(id).type)
          mutateDraft(id, (d) => {
            const positions = [...d.positions]
            positions.splice(afterIndex === undefined ? positions.length : afterIndex + 1, 0, position)
            return { ...d, positions }
          })
          return position.id
        },

        insertCatalogItem: (id, item, positionId) => {
          const doc = find(id)
          const config = useSettingsStore.getState().docTypes[doc.type]
          const keys = new Set(config.positionFields.map((f) => f.key))
          const fromItem = {
            title: item.title, description: item.description, unitId: item.unitId, unitPrice: item.price,
            taxRateId: item.taxRateId, categoryId: item.categoryId,
            custom: { ...defaultCustomValues(config.positionFields), ...Object.fromEntries(Object.entries(item.custom).filter(([k]) => keys.has(k))) },
          }
          mutateDraft(id, (d) => ({
            ...d,
            positions: positionId
              ? d.positions.map((p) => (p.id === positionId ? { ...p, ...fromItem } : p))
              : [...d.positions, { ...emptyPosition('item', d.type), ...fromItem }],
          }))
        },

        updatePosition: (id, positionId, patch) =>
          mutateDraft(id, (d) => ({ ...d, positions: d.positions.map((p) => (p.id === positionId ? { ...p, ...patch } : p)) })),

        removePosition: (id, positionId) => mutateDraft(id, (d) => ({ ...d, positions: d.positions.filter((p) => p.id !== positionId) })),

        movePosition: (id, from, to) =>
          mutateDraft(id, (d) => {
            const positions = [...d.positions]
            const [moved] = positions.splice(from, 1)
            positions.splice(to, 0, moved)
            return { ...d, positions }
          }),

        finalizeDocument: (id) => {
          const doc = find(id)
          if (doc.status !== 'draft') return { ok: true }
          const issues = checkCompliance(buildComplianceContextFor(doc))
          if (issues.length) return { ok: false, issues }
          const number = useSettingsStore.getState().allocateNumber(doc.type, doc.date)
          const finalizedAt = nowIso()
          const snapshot = takeSnapshot(doc.customerId)
          const status: DocStatus = doc.type === 'cancellation' ? 'closed' : 'open'
          set((s) => ({
            documents: s.documents.map((d) => {
              if (d.id === id) return { ...d, number, status, finalizedAt, snapshot, updatedAt: finalizedAt }
              if (doc.type === 'cancellation' && d.id === doc.sourceId) return { ...d, status: 'cancelled', cancelledById: id, updatedAt: finalizedAt }
              return d
            }),
          }))
          return { ok: true }
        },

        setStatus: (id, status) => {
          const doc = find(id)
          if (doc.status === 'draft' || !canTransition(doc.type, doc.status, status)) {
            console.warn(`Statuswechsel ${doc.status} → ${status} nicht erlaubt.`)
            return
          }
          replace({ ...doc, status, updatedAt: nowIso() })
        },

        convertTo: (id, target) => {
          const source = find(id)
          // Ein offener Storno-Entwurf zählt schon als Storno — kein zweiter.
          if (target === 'cancellation' && canConvert(source, target)) {
            const existing = get().documents.find((d) => d.sourceId === id && d.type === 'cancellation')
            if (existing) return { id: existing.id, droppedFields: [] }
          }
          const { document, droppedFields } = convertDocument(source, target, {
            targetConfig: useSettingsStore.getState().docTypes[target], today: todayIso(), now: nowIso(), newId,
          })
          set((s) => ({ documents: [document, ...s.documents] }))
          return { id: document.id, droppedFields }
        },

        duplicateDocument: (id) => {
          const src = find(id)
          if (src.type === 'cancellation') throw new Error('Stornos entstehen nur aus einer Rechnung und lassen sich nicht duplizieren.')
          const copy: Document = {
            ...src, id: newId(), status: 'draft', number: null, date: todayIso(), sourceId: null, cancelledById: null, finalizedAt: null, snapshot: null,
            positions: src.positions.map((p) => ({ ...p, id: newId() })), createdAt: nowIso(), updatedAt: nowIso(),
          }
          set((s) => ({ documents: [copy, ...s.documents] }))
          return copy.id
        },

        deleteDraft: (id) => {
          if (isLocked(find(id))) return
          set((s) => ({ documents: s.documents.filter((d) => d.id !== id) }))
        },
      }
    },
    { name: 'openbill:documents', version: 1, migrate: () => ({ documents: seed().documents }) as never, partialize: (s) => ({ documents: s.documents }), merge: mergeOrSeed((s) => Array.isArray(s.documents)) },
  ),
)
