import { addDays } from './dates'
import type { CustomValues, DocType, DocTypeConfig, Document } from './types'

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

export interface ConvertOptions { targetConfig: DocTypeConfig; today: string; now: string; newId: () => string }

export function convertDocument(source: Document, target: DocType, opts: ConvertOptions): { document: Document; droppedFields: string[] } {
  if (!canConvert(source, target)) throw new Error(`Umwandlung nicht erlaubt: ${source.type} (${source.status}) → ${target}`)
  const { targetConfig, today, now, newId } = opts
  const dropped = new Set<string>()
  const pick = (custom: CustomValues, keys: Set<string>, prefix: string): CustomValues =>
    Object.fromEntries(
      Object.entries(custom).filter(([k]) => {
        if (keys.has(k)) return true
        dropped.add(`${prefix}${k}`)
        return false
      }),
    )
  const docKeys = new Set(targetConfig.documentFields.map((f) => f.key))
  const posKeys = new Set(targetConfig.positionFields.map((f) => f.key))
  const sign = target === 'cancellation' ? -1 : 1

  const positions = source.positions
    .filter((p) => p.kind !== 'optional')
    .map((p) => ({ ...p, id: newId(), quantity: p.kind === 'item' ? p.quantity * sign : p.quantity, custom: pick(p.custom, posKeys, 'position.') }))

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
    positions,
    custom: pick(source.custom, docKeys, 'document.'),
    sourceId: source.id,
    cancelledById: null,
    finalizedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  return { document, droppedFields: [...dropped] }
}
