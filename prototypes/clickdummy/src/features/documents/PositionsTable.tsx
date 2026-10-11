import { useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { BookOpen, ChevronDown, GripVertical, Heading, ListPlus, Plus, Text, Trash2 } from 'lucide-react'
import { formatMoney } from '@/domain/format'
import type { Totals } from '@/domain/totals'
import type { Customer, DocTypeConfig, Document, Position, PositionKind } from '@/domain/types'
import { useDocumentStore } from '@/store/documentStore'
import { useSettingsStore } from '@/store/settingsStore'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { cx } from '@/ui/cx'
import { CustomFieldInput, fieldDomId } from '@/ui/CustomFieldInput'
import { controlClass, Textarea } from '@/ui/form'
import { NumberInput } from '@/ui/NumberInput'
import { Sheet } from '@/ui/Sheet'
import { CatalogAutocomplete } from './CatalogAutocomplete'
import { CatalogPickerDialog } from './CatalogPickerDialog'
import { ProfileBadge } from './DocumentHeaderFields'

const GRID = 'grid grid-cols-[16px_20px_minmax(150px,1fr)_62px_64px_84px_58px_88px_28px] items-center gap-x-1.5'

interface RowProps {
  doc: Document
  position: Position
  index: number | null
  config: DocTypeConfig
  customer: Customer | null
  totals: Totals
  locked: boolean
}

function TaxCell({ position, customer, locked, onChange }: { position: Position; customer: Customer | null; locked: boolean; onChange(id: string): void }) {
  const { taxRates, org } = useSettingsStore()
  if (org.taxationMode === 'small_business') return <span className="text-xs text-muted" title="Kleinunternehmer, § 19 UStG">§ 19</span>
  if (customer?.taxTreatment === 'eu_reverse_charge') return <span className="text-xs text-muted" title="Reverse Charge">RC</span>
  if (customer?.taxTreatment === 'third_country') return <span className="text-xs text-muted" title="Drittland">0 %</span>
  return (
    <select
      id={fieldDomId(`positions.${position.id}.tax_rate`)}
      aria-label="Steuersatz"
      disabled={locked}
      value={position.taxRateId ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className={cx(controlClass({ error: !taxRates.some((r) => r.id === position.taxRateId) }), 'h-8 appearance-none px-2 text-[13px]')}
    >
      {!taxRates.some((r) => r.id === position.taxRateId) && <option value="">fehlt</option>}
      {taxRates.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
    </select>
  )
}

function PositionRow({ doc, position: p, index, config, customer, totals, locked }: RowProps) {
  const { updatePosition, removePosition, insertCatalogItem, addPosition } = useDocumentStore()
  const units = useSettingsStore((s) => s.units)
  const [open, setOpen] = useState(false)
  const sortable = useSortable({ id: p.id, disabled: locked })
  const set = (patch: Partial<Position>) => updatePosition(doc.id, p.id, patch)
  const priced = p.kind === 'item' || p.kind === 'optional'
  const strict = config.profile === 'en16931'
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }
  const hasDetails = priced || p.kind === 'text'

  const handle = (
    <button
      type="button"
      aria-label="Position verschieben"
      disabled={locked}
      className="cursor-grab text-faint hover:text-ink disabled:cursor-default disabled:opacity-0"
      {...sortable.attributes}
      {...sortable.listeners}
    >
      <GripVertical size={15} />
    </button>
  )
  const menu = !locked && (
    <div className="flex justify-end">
      <Button size="sm" variant="ghost" aria-label="Position löschen" title="Position löschen" onClick={() => removePosition(doc.id, p.id)} icon={<Trash2 size={14} />} />
    </div>
  )

  return (
    <div ref={sortable.setNodeRef} style={style} className={cx('border-b border-line bg-sheet py-1.5 last:border-0', sortable.isDragging && 'relative z-10 shadow-lg')}>
      {p.kind === 'heading' ? (
        <div className={cx(GRID, 'pt-2')}>
          {handle}
          <Heading size={14} className="text-faint" />
          <input
            aria-label="Überschrift"
            disabled={locked}
            value={p.title}
            placeholder="Überschrift, z. B. Konzeption"
            onChange={(e) => set({ title: e.target.value })}
            className={cx(controlClass(), 'col-span-5 h-8 border-transparent bg-transparent font-cond text-[15px] font-semibold hover:border-line')}
          />
          <span className="text-right text-xs text-muted" title="Zwischensumme der Gruppe">
            {formatMoney(totals.groups.find((g) => g.positionId === p.id)?.net ?? 0)}
          </span>
          {menu}
        </div>
      ) : p.kind === 'text' ? (
        <div className={GRID}>
          {handle}
          <Text size={14} className="text-faint" />
          <input
            aria-label="Textzeile"
            disabled={locked}
            value={p.title}
            placeholder="Hinweis ohne Betrag"
            onChange={(e) => set({ title: e.target.value })}
            className={cx(controlClass(), 'col-span-6 h-8 italic')}
          />
          {menu}
        </div>
      ) : (
        <div className={GRID}>
          {handle}
          <span className="text-right text-xs text-faint">{index}</span>
          <div className="flex min-w-0 items-center gap-1">
            <button type="button" aria-label="Details ein- oder ausblenden" aria-expanded={open} onClick={() => setOpen(!open)} className="text-faint hover:text-ink">
              <ChevronDown size={14} className={cx('transition-transform', open && 'rotate-180')} />
            </button>
            <div className="min-w-0 flex-1">
              <CatalogAutocomplete
                id={fieldDomId(`positions.${p.id}.title`)}
                value={p.title}
                disabled={locked}
                placeholder="Leistung oder Katalog durchsuchen"
                onChange={(title) => set({ title })}
                onPick={(item) => insertCatalogItem(doc.id, item, p.id)}
              />
            </div>
            {p.kind === 'optional' && <Badge tone="yellow">optional</Badge>}
          </div>
          <NumberInput
            id={fieldDomId(`positions.${p.id}.quantity`)}
            aria-label="Menge"
            disabled={locked}
            value={p.quantity}
            decimals={units.find((u) => u.id === p.unitId)?.decimals ?? 2}
            onValue={(quantity) => set({ quantity })}
          />
          <select
            id={fieldDomId(`positions.${p.id}.unit`)}
            aria-label="Einheit"
            disabled={locked}
            value={p.unitId ?? ''}
            onChange={(e) => set({ unitId: e.target.value || null })}
            className={cx(controlClass({ error: !units.some((u) => u.id === p.unitId) }), 'h-8 appearance-none px-2 text-[13px]')}
          >
            {!units.some((u) => u.id === p.unitId) && <option value="">–</option>}
            {units.map((u) => <option key={u.id} value={u.id} title={u.name}>{u.symbol}</option>)}
          </select>
          <NumberInput aria-label="Einzelpreis" disabled={locked} value={p.unitPrice} onValue={(unitPrice) => set({ unitPrice })} />
          <TaxCell position={p} customer={customer} locked={locked} onChange={(taxRateId) => set({ taxRateId })} />
          <span className={cx('text-right font-medium', p.kind === 'optional' && 'text-muted')}>{formatMoney(totals.lines[p.id]?.net ?? 0)}</span>
          {menu}
        </div>
      )}

      {open && hasDetails && priced && (
        <div className="mt-2 mb-2 ml-[44px] grid gap-3 rounded-[3px] bg-sheet-2 p-3 sm:grid-cols-2">
          <Textarea label="Beschreibung" rows={2} disabled={locked} value={p.description} onChange={(e) => set({ description: e.target.value })} wrapClassName="sm:col-span-2" />
          {config.positionFields.map((def) => (
            <CustomFieldInput
              key={def.id}
              id={fieldDomId(`positions.${p.id}.custom.${def.key}`)}
              def={def}
              value={p.custom[def.key]}
              disabled={locked}
              onChange={(v) => set({ custom: { ...p.custom, [def.key]: v } })}
            />
          ))}
          {!locked && (
            <div className="flex gap-2 sm:col-span-2">
              <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => addPosition(doc.id, 'item', doc.positions.indexOf(p))}>Leistung darunter</Button>
            </div>
          )}
        </div>
      )}
      {!open && p.description && priced && <p className="mt-0.5 ml-[44px] truncate pr-40 text-xs text-muted">{p.description}</p>}
      {strict && priced && p.kind === 'item' && !open && config.positionFields.some((d) => d.required && (p.custom[d.key] ?? '') === '') && (
        <p className="mt-0.5 ml-[44px] text-xs text-danger">Pflichtfelder fehlen, Details öffnen</p>
      )}
    </div>
  )
}

export function PositionsTable({ doc, config, customer, totals, locked }: { doc: Document; config: DocTypeConfig; customer: Customer | null; totals: Totals; locked: boolean }) {
  const { addPosition, movePosition } = useDocumentStore()
  const [picker, setPicker] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const strict = config.profile === 'en16931'

  let n = 0
  const indexes = doc.positions.map((p) => (p.kind === 'item' || p.kind === 'optional' ? ++n : null))

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    movePosition(doc.id, doc.positions.findIndex((p) => p.id === active.id), doc.positions.findIndex((p) => p.id === over.id))
  }

  const add = (kind: PositionKind) => {
    const id = addPosition(doc.id, kind)
    requestAnimationFrame(() => document.getElementById(fieldDomId(`positions.${id}.title`))?.focus())
  }

  return (
    <Sheet
      id={fieldDomId('positions')}
      title="Positionen"
      description={strict ? <span className="inline-flex items-center gap-2">Einheit mit Code und Menge sind Pflicht <ProfileBadge /></span> : undefined}
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <div className="min-w-[640px] px-4">
          <div className={cx(GRID, 'border-b border-line py-2 text-[12px] text-muted')}>
            <span />
            <span className="text-right">Pos.</span>
            <span className="pl-5">Bezeichnung</span>
            <span className="text-right">Menge</span>
            <span>Einheit</span>
            <span className="text-right">Einzelpreis</span>
            <span>Steuer</span>
            <span className="text-right">Gesamt</span>
            <span />
          </div>
          {doc.positions.length === 0 && (
            <p className="py-6 text-sm text-muted">Noch keine Positionen. Füg eine Leistung hinzu oder übernimm Einträge aus dem Katalog.</p>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={doc.positions.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              {doc.positions.map((p, i) => (
                <PositionRow key={p.id} doc={doc} position={p} index={indexes[i]} config={config} customer={customer} totals={totals} locked={locked} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </div>
      {!locked && (
        <div className="flex flex-wrap gap-1.5 border-t border-line bg-sheet-2 px-4 py-2.5">
          <Button size="sm" icon={<Plus size={14} />} onClick={() => add('item')}>Leistung</Button>
          <Button size="sm" icon={<BookOpen size={14} />} onClick={() => setPicker(true)}>Aus Katalog</Button>
          <Button size="sm" variant="ghost" icon={<Heading size={14} />} onClick={() => add('heading')}>Überschrift</Button>
          <Button size="sm" variant="ghost" icon={<Text size={14} />} onClick={() => add('text')}>Textzeile</Button>
          {doc.type === 'offer' && <Button size="sm" variant="ghost" icon={<ListPlus size={14} />} onClick={() => add('optional')}>Optional</Button>}
        </div>
      )}
      <CatalogPickerDialog key={String(picker)} open={picker} onClose={() => setPicker(false)} docId={doc.id} />
    </Sheet>
  )
}
