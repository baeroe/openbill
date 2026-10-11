import { defaultCustomValues, fieldsFor } from '@/domain/fields'
import type { Document, Position, PositionGroup, PositionKind, Settings } from '@/domain/types'

/** Reine Hilfsfunktionen für Gruppen und Positionen im lokalen Entwurf. */

export const localId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`

export const isPriced = (kind: PositionKind) => kind !== 'text'

export function newPosition(kind: PositionKind, settings: Settings, doc: Pick<Document, 'type'>): Position {
  const priced = isPriced(kind)
  return {
    id: localId('pos'), kind, title: '', description: '',
    quantity: priced ? 1 : 0,
    unitId: priced ? (settings.units[0]?.id ?? null) : null,
    unitPrice: 0,
    taxRateId: priced ? (settings.taxRates[0]?.id ?? null) : null,
    custom: priced ? defaultCustomValues(fieldsFor(settings.fieldDefs, 'position', doc.type)) : {},
  }
}

const mapGroups = (doc: Document, fn: (g: PositionGroup) => PositionGroup): Document => ({ ...doc, groups: doc.groups.map(fn) })

export function addPosition(doc: Document, groupId: string, position: Position, afterId?: string): Document {
  return mapGroups(doc, (g) => {
    if (g.id !== groupId) return g
    const positions = [...g.positions]
    const i = afterId ? positions.findIndex((p) => p.id === afterId) : -1
    positions.splice(i < 0 ? positions.length : i + 1, 0, position)
    return { ...g, positions }
  })
}

export function updatePosition(doc: Document, id: string, patch: Partial<Position>): Document {
  return mapGroups(doc, (g) => (g.positions.some((p) => p.id === id) ? { ...g, positions: g.positions.map((p) => (p.id === id ? { ...p, ...patch } : p)) } : g))
}

export function removePosition(doc: Document, id: string): Document {
  return mapGroups(doc, (g) => ({ ...g, positions: g.positions.filter((p) => p.id !== id) }))
}

export function addGroup(doc: Document, title: string, first: Position): Document {
  return { ...doc, groups: [...doc.groups, { id: localId('grp'), title, positions: [first] }] }
}

export function updateGroup(doc: Document, id: string, patch: Partial<PositionGroup>): Document {
  return mapGroups(doc, (g) => (g.id === id ? { ...g, ...patch } : g))
}

export function removeGroup(doc: Document, id: string): { doc: Document; group: PositionGroup; index: number } {
  const index = doc.groups.findIndex((g) => g.id === id)
  const group = doc.groups[index]
  return { doc: { ...doc, groups: doc.groups.filter((g) => g.id !== id) }, group, index }
}

export function restoreGroup(doc: Document, group: PositionGroup, index: number): Document {
  const groups = [...doc.groups]
  groups.splice(Math.min(index, groups.length), 0, group)
  return { ...doc, groups }
}

/** Löst eine Gruppe auf: Ihre Positionen wandern zu den losen Positionen (ohne Überschrift). */
export function dissolveGroup(doc: Document, id: string): Document {
  const group = doc.groups.find((g) => g.id === id)
  if (!group) return doc
  const loose = doc.groups.find((g) => g.title === null && g.id !== id)
  if (!loose) return updateGroup(doc, id, { title: null })
  return {
    ...doc,
    groups: doc.groups
      .filter((g) => g.id !== id)
      .map((g) => (g.id === loose.id ? { ...g, positions: [...g.positions, ...group.positions] } : g)),
  }
}

export function moveGroup(doc: Document, from: number, to: number): Document {
  const groups = [...doc.groups]
  const [g] = groups.splice(from, 1)
  groups.splice(to, 0, g)
  return { ...doc, groups }
}

export const groupOf = (doc: Document, positionId: string) => doc.groups.find((g) => g.positions.some((p) => p.id === positionId))

/** Verschiebt eine Position in eine Gruppe an einen Index (auch innerhalb derselben Gruppe). */
export function movePosition(doc: Document, positionId: string, toGroupId: string, toIndex: number): Document {
  const from = groupOf(doc, positionId)
  if (!from) return doc
  const position = from.positions.find((p) => p.id === positionId)!
  const without = doc.groups.map((g) => (g.id === from.id ? { ...g, positions: g.positions.filter((p) => p.id !== positionId) } : g))
  return {
    ...doc,
    groups: without.map((g) => {
      if (g.id !== toGroupId) return g
      const positions = [...g.positions]
      positions.splice(Math.max(0, Math.min(toIndex, positions.length)), 0, position)
      return { ...g, positions }
    }),
  }
}
