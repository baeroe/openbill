import { useState } from 'react'
import {
  closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, FolderPlus, GripVertical, MoreHorizontal, Plus, Trash2, Ungroup } from 'lucide-react'
import type { PositionSuggestion } from '@/api/documents'
import { Button, cx, Menu, MenuItem } from '@/components/ui'
import { formatMoney } from '@/domain/format'
import type { Totals } from '@/domain/totals'
import type { Document, FieldDef, Position, PositionGroup, Settings } from '@/domain/types'
import { toast } from '@/store/toast'
import * as ops from './ops'
import { SortablePositionRow } from './PositionRow'

interface Props {
  doc: Document
  settings: Settings
  totals: Totals
  posDefs: FieldDef[]
  readOnly: boolean
  invalidPaths: Set<string>
  suggestions: PositionSuggestion[]
  update(fn: (d: Document) => Document): void
}

const gid = (id: string) => `group:${id}`
const pid = (id: string) => `pos:${id}`
const bodyId = (id: string) => `body:${id}`
const strip = (id: string | number) => String(id).replace(/^(group|pos|body):/, '')

/** Positionsgruppen mit Drag & Drop: Gruppen untereinander, Positionen innerhalb und zwischen Gruppen. */
export function GroupsEditor({ doc, settings, totals, posDefs, readOnly, invalidPaths, suggestions, update }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [focusId, setFocusId] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const smallBusiness = settings.org.taxationMode === 'small_business'
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Gruppen kollidieren nur mit Gruppen, Positionen mit Positionen und Gruppenkörpern (leere Gruppen)
  const collision: CollisionDetection = (args) => {
    const isGroup = String(args.active.id).startsWith('group:')
    return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => String(c.id).startsWith('group:') === isGroup) })
  }

  const targetGroup = (overId: string) =>
    overId.startsWith('body:') ? strip(overId) : overId.startsWith('pos:') ? ops.groupOf(doc, strip(overId))?.id : undefined

  const onDragStart = (e: DragStartEvent) => setDragging(String(e.active.id))

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || !String(active.id).startsWith('pos:')) return
    const posId = strip(active.id)
    const from = ops.groupOf(doc, posId)
    const to = targetGroup(String(over.id))
    if (!from || !to || from.id === to) return
    const toGroup = doc.groups.find((g) => g.id === to)!
    const overIndex = String(over.id).startsWith('pos:') ? toGroup.positions.findIndex((p) => p.id === strip(over.id)) : toGroup.positions.length
    update((d) => ops.movePosition(d, posId, to, overIndex < 0 ? toGroup.positions.length : overIndex))
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null)
    if (!over || active.id === over.id) return
    const a = String(active.id)
    if (a.startsWith('group:')) {
      const from = doc.groups.findIndex((g) => g.id === strip(a))
      const to = doc.groups.findIndex((g) => g.id === strip(over.id))
      if (from >= 0 && to >= 0) update((d) => ops.moveGroup(d, from, to))
      return
    }
    const posId = strip(a)
    const group = ops.groupOf(doc, posId)
    const to = targetGroup(String(over.id))
    if (!group || group.id !== to) return
    const index = String(over.id).startsWith('pos:') ? group.positions.findIndex((p) => p.id === strip(over.id)) : group.positions.length - 1
    update((d) => ops.movePosition(d, posId, group.id, index))
  }

  const addPosition = (groupId: string, afterId?: string) => {
    const p = ops.newPosition('item', settings, doc)
    update((d) => ops.addPosition(d, groupId, p, afterId))
    setFocusId(p.id)
  }

  const addGroup = () => {
    const p = ops.newPosition('item', settings, doc)
    const n = doc.groups.filter((g) => g.title !== null).length + 1
    const before = new Set(doc.groups.map((g) => g.id))
    update((d) => ops.addGroup(d, `Gruppe ${n}`, p))
    // Neue Gruppe: Titel fokussieren und markieren, damit man direkt den Namen tippt
    requestAnimationFrame(() => {
      const el = [...document.querySelectorAll<HTMLInputElement>('.group__title')].find((i) => !before.has(i.dataset.groupId ?? ''))
      el?.focus()
      el?.select()
    })
  }

  const removeGroup = (g: PositionGroup) => {
    const { group, index } = ops.removeGroup(doc, g.id)
    update((d) => ops.removeGroup(d, g.id).doc)
    toast.info(`„${g.title ?? 'Lose Positionen'}“ entfernt`, { label: 'Rückgängig', run: () => update((d) => ops.restoreGroup(d, group, index)) })
  }

  const removePosition = (p: Position) => {
    const group = ops.groupOf(doc, p.id)!
    const index = group.positions.findIndex((x) => x.id === p.id)
    update((d) => ops.removePosition(d, p.id))
    if (p.title.trim() || p.unitPrice) {
      toast.info(`„${p.title || 'Position'}“ entfernt`, { label: 'Rückgängig', run: () => update((d) => ops.movePosition(ops.addPosition(d, group.id, p), p.id, group.id, index)) })
    }
  }

  const toggle = (id: string) => setCollapsed((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  const titled = doc.groups.filter((g) => g.title !== null).length
  const draggingGroup = dragging?.startsWith('group:') ? doc.groups.find((g) => g.id === strip(dragging)) : null

  return (
    <section className="groups" data-path="positions" aria-label="Positionen">
      <div className={cx('pos-head', smallBusiness && 'pos--no-tax')} aria-hidden>
        <span /><span>Bezeichnung</span><span className="r">Menge</span><span>Einheit</span><span className="r">Einzelpreis</span>{!smallBusiness && <span>Steuer</span>}<span className="r">Summe</span><span />
      </div>

      <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <SortableContext items={doc.groups.map((g) => gid(g.id))} strategy={verticalListSortingStrategy}>
          {doc.groups.map((g) => (
            <SortableGroup key={g.id} group={g} readOnly={readOnly} collapsed={collapsed.has(g.id)} canDrag={titled > 0 || doc.groups.length > 1}
              total={totals.groups[g.id]?.net ?? 0} optionalTotal={totals.groups[g.id]?.optionalNet ?? 0}
              onToggle={() => toggle(g.id)}
              onRename={(title) => update((d) => ops.updateGroup(d, g.id, { title }))}
              onRemove={() => removeGroup(g)}
              onDissolve={() => update((d) => ops.dissolveGroup(d, g.id))}
              onAdd={() => addPosition(g.id)}>
              <SortableContext items={g.positions.map((p) => pid(p.id))} strategy={verticalListSortingStrategy}>
                {g.positions.map((p, i) => (
                  <SortablePositionRow key={p.id} position={p} docType={doc.type} settings={settings} posDefs={posDefs}
                    net={totals.lines[p.id]?.net} readOnly={readOnly} smallBusiness={smallBusiness} invalidPaths={invalidPaths}
                    suggestions={suggestions} autoFocus={focusId === p.id}
                    onChange={(patch) => update((d) => ops.updatePosition(d, p.id, patch))}
                    onRemove={() => removePosition(p)}
                    onEnter={() => { if (i === g.positions.length - 1) addPosition(g.id, p.id) }} />
                ))}
              </SortableContext>
            </SortableGroup>
          ))}
        </SortableContext>
        <DragOverlay>
          {draggingGroup && <div className="group group--overlay"><div className="group__head"><GripVertical className="group__grip" /><b>{draggingGroup.title ?? 'Lose Positionen'}</b></div></div>}
        </DragOverlay>
      </DndContext>

      {doc.groups.every((g) => g.positions.length === 0) && !readOnly && (
        <p className="groups__empty">Noch keine Positionen. Füge eine Leistung hinzu oder lege Gruppen an, z. B. „Konzept“ und „Umsetzung“.</p>
      )}

      {!readOnly && (
        <div className="groups__actions">
          <Button variant="soft" size="sm" icon={<FolderPlus />} onClick={addGroup}>Gruppe hinzufügen</Button>
          {!doc.groups.some((g) => g.title === null) && (
            <Button variant="ghost" size="sm" icon={<Plus />} onClick={() => {
              const p = ops.newPosition('item', settings, doc)
              update((d) => ({ ...d, groups: [{ id: ops.localId('grp'), title: null, positions: [p] }, ...d.groups] }))
              setFocusId(p.id)
            }}>Position ohne Gruppe</Button>
          )}
        </div>
      )}
    </section>
  )
}

function SortableGroup({ group: g, readOnly, collapsed, canDrag, total, optionalTotal, onToggle, onRename, onRemove, onDissolve, onAdd, children }: {
  group: PositionGroup
  readOnly: boolean
  collapsed: boolean
  canDrag: boolean
  total: number
  optionalTotal: number
  onToggle(): void
  onRename(title: string): void
  onRemove(): void
  onDissolve(): void
  onAdd(): void
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: gid(g.id), disabled: readOnly || !canDrag })
  const { setNodeRef: setBodyRef, isOver } = useDroppable({ id: bodyId(g.id), disabled: readOnly })
  const loose = g.title === null
  const count = g.positions.filter((p) => p.kind !== 'text').length

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cx('group', loose && 'group--loose', isDragging && 'is-dragging', isOver && 'is-over')}>
      {!loose && (
        <div className="group__head">
          {!readOnly && (
            <button type="button" ref={setActivatorNodeRef} className="drag-handle group__grip" aria-label={`Gruppe „${g.title}“ verschieben`} {...attributes} {...listeners}>
              <GripVertical />
            </button>
          )}
          <button type="button" className="group__toggle" onClick={onToggle} aria-expanded={!collapsed} aria-label={collapsed ? 'Gruppe aufklappen' : 'Gruppe einklappen'}>
            <ChevronDown />
          </button>
          <input className="group__title" data-group-id={g.id} value={g.title ?? ''} disabled={readOnly} aria-label="Name der Gruppe" placeholder="Name der Gruppe" onChange={(e) => onRename(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.closest('.group')?.querySelector<HTMLInputElement>('.pos__title')?.focus() } }} />
          {collapsed && <span className="group__count">{count === 1 ? '1 Position' : `${count} Positionen`}</span>}
          <span className="group__sum num" title="Zwischensumme netto">
            {optionalTotal !== 0 && <span className="group__opt">+ {formatMoney(optionalTotal)} optional</span>}
            {formatMoney(total)}
          </span>
          {!readOnly && (
            <Menu trigger={({ toggle, ref, open }) => (
              <Button ref={ref} variant="ghost" size="sm" iconOnly icon={<MoreHorizontal />} onClick={toggle} aria-haspopup="menu" aria-expanded={open}>Gruppe bearbeiten</Button>
            )}>
              {(close) => (
                <>
                  <MenuItem icon={<Ungroup />} onClick={() => { close(); onDissolve() }}>Gruppe auflösen</MenuItem>
                  <MenuItem danger icon={<Trash2 />} onClick={() => { close(); onRemove() }}>Gruppe mit Positionen entfernen</MenuItem>
                </>
              )}
            </Menu>
          )}
        </div>
      )}
      {!collapsed && (
        <div ref={setBodyRef} className="group__body">
          {children}
          {g.positions.length === 0 && <p className="group__empty">Zieh Positionen hierher oder füge eine neue hinzu.</p>}
          {!readOnly && (
            <div className="group__foot">
              <button type="button" className="group__add" onClick={onAdd}><Plus />Position hinzufügen</button>
              {loose && g.positions.length === 0 && <button type="button" className="group__add" onClick={onRemove}>Entfernen</button>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
