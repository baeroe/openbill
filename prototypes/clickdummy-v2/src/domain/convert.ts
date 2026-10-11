import { addDays } from './dates'
import { fieldsFor } from './fields'
import type { CustomValues, DocType, DocTypeConfig, Document, FieldDef } from './types'

export const CONVERSIONS: Record<DocType, DocType[]> = {
  offer: ['confirmation', 'invoice'],
  confirmation: ['invoice'],
  invoice: ['cancellation'],
  cancellation: [],
}

export function canConvert(source: Pick<Document, 'type' | 'status' | 'cancelledById'>, target: DocType): boolean {
  if (!CONVERSIONS[source.type].includes(target)) return false
  if (target === 'cancellation') return (source.status === 'open' || source.status === 'paid') && !source.cancelledById
  if (source.type === 'offer') return source.status === 'accepted'
  return source.status !== 'draft'
}

export interface ConvertOptions { targetConfig: DocTypeConfig; fieldDefs: FieldDef[]; today: string; now: string; newId: () => string }

/**
 * Wandelt ein Dokument um. Eigene Felder sind zentral definiert: Ein Wert wandert mit, wenn das Feld
 * auch für den Zieltyp gilt; sonst wird er verworfen und gemeldet.
 */
export function convertDocument(source: Document, target: DocType, opts: ConvertOptions): { document: Document; droppedFields: string[] } {
  if (!canConvert(source, target)) throw new Error(`Umwandlung nicht erlaubt: ${source.type} (${source.status}) → ${target}`)
  const { targetConfig, fieldDefs, today, now, newId } = opts
  const dropped = new Map<string, string>()
  const labelOf = (scope: 'document' | 'position', key: string) => fieldDefs.find((d) => d.scope === scope && d.key === key)?.label ?? key
  const pick = (custom: CustomValues, scope: 'document' | 'position'): CustomValues => {
    const keys = new Set(fieldsFor(fieldDefs, scope, target).map((d) => d.key))
    return Object.fromEntries(
      Object.entries(custom).filter(([k]) => {
        if (keys.has(k)) return true
        dropped.set(`${scope}.${k}`, labelOf(scope, k))
        return false
      }),
    )
  }
  const sign = target === 'cancellation' ? -1 : 1

  const groups = source.groups
    .map((g) => ({
      id: newId(),
      title: g.title,
      positions: g.positions
        .filter((p) => p.kind !== 'optional')
        .map((p) => ({ ...p, id: newId(), quantity: p.kind === 'item' ? p.quantity * sign : p.quantity, custom: pick(p.custom, 'position') })),
    }))
    .filter((g) => g.positions.length > 0 || g.title === null)

  const document: Document = {
    id: newId(),
    type: target,
    status: 'draft',
    number: null,
    date: today,
    customerId: source.customerId,
    contactId: source.contactId,
    serviceDate: source.serviceDate ?? (target === 'invoice' ? today : null),
    serviceDateEnd: source.serviceDateEnd,
    dueDate: target === 'invoice' && targetConfig.paymentTermDays !== null ? addDays(today, targetConfig.paymentTermDays) : null,
    validUntil: null,
    intro: source.intro,
    closing: source.closing,
    templateId: targetConfig.templateId,
    groups,
    custom: pick(source.custom, 'document'),
    sourceId: source.id,
    cancelledById: null,
    finalizedAt: null,
    snapshot: null,
    createdAt: now,
    updatedAt: now,
  }
  return { document, droppedFields: [...dropped.values()] }
}
