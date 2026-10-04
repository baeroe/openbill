import type { DocStatus, DocType, Document } from './types'

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  offer: 'Angebot',
  confirmation: 'Auftragsbestätigung',
  invoice: 'Rechnung',
  cancellation: 'Storno',
}

export const DOC_TYPE_PLURAL: Record<DocType, string> = {
  offer: 'Angebote',
  confirmation: 'Auftragsbestätigungen',
  invoice: 'Rechnungen',
  cancellation: 'Stornos',
}

export const STATUS_LABELS: Record<DocStatus, string> = {
  draft: 'Entwurf',
  open: 'Offen',
  accepted: 'Angenommen',
  rejected: 'Abgelehnt',
  done: 'Erledigt',
  paid: 'Bezahlt',
  cancelled: 'Storniert',
  closed: 'Abgeschlossen',
}

export const STATUS_ACTION_LABELS: Partial<Record<DocStatus, string>> = {
  accepted: 'Als angenommen markieren',
  rejected: 'Als abgelehnt markieren',
  done: 'Als erledigt markieren',
  paid: 'Als bezahlt markieren',
}

const TRANSITIONS: Record<DocType, Partial<Record<DocStatus, DocStatus[]>>> = {
  offer: { draft: ['open'], open: ['accepted', 'rejected'] },
  confirmation: { draft: ['open'], open: ['done'] },
  invoice: { draft: ['open'], open: ['paid'] },
  cancellation: { draft: ['closed'] },
}

export const nextStatuses = (type: DocType, from: DocStatus): DocStatus[] => TRANSITIONS[type][from] ?? []
export const canTransition = (type: DocType, from: DocStatus, to: DocStatus): boolean => nextStatuses(type, from).includes(to)
export const isLocked = (doc: Pick<Document, 'status'>): boolean => doc.status !== 'draft'
export const isOverdue = (doc: Pick<Document, 'type' | 'status' | 'dueDate'>, today: string): boolean =>
  doc.type === 'invoice' && doc.status === 'open' && !!doc.dueDate && doc.dueDate < today
