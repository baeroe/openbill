import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AlignLeft, CircleDashed, GripVertical, ListPlus, MoreHorizontal, Package, Trash2 } from 'lucide-react'
import type { PositionSuggestion } from '@/api/documents'
import { CustomFieldInput } from '@/components/CustomFieldInput'
import { Button, cx, Menu, MenuItem, NumberInput } from '@/components/ui'
import { formatMoney } from '@/domain/format'
import type { DocType, FieldDef, Position, PositionKind, Settings } from '@/domain/types'
import { TitleAutocomplete } from './TitleAutocomplete'

const KIND_LABELS: Record<PositionKind, string> = { item: 'Leistung', text: 'Textzeile', optional: 'Optionale Leistung' }

export interface PositionRowProps {
  position: Position
  docType: DocType
  settings: Settings
  posDefs: FieldDef[]
  net: number | undefined
  readOnly: boolean
  smallBusiness: boolean
  invalidPaths: Set<string>
  suggestions: PositionSuggestion[]
  autoFocus: boolean
  onChange(patch: Partial<Position>): void
  onRemove(): void
  onEnter(): void
}

export function SortablePositionRow(props: PositionRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: `pos:${props.position.id}`, disabled: props.readOnly })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cx('pos-wrap', isDragging && 'is-dragging')}>
      <PositionRow {...props} handle={
        props.readOnly ? <span className="pos__handle" aria-hidden /> : (
          <button type="button" ref={setActivatorNodeRef} className="pos__handle drag-handle" aria-label={`„${props.position.title || 'Position'}“ verschieben`} {...attributes} {...listeners}>
            <GripVertical />
          </button>
        )} />
    </div>
  )
}

export function PositionRow({ position: p, docType, settings, posDefs, net, readOnly, smallBusiness, invalidPaths, suggestions, autoFocus, onChange, onRemove, onEnter, handle }: PositionRowProps & { handle?: React.ReactNode }) {
  const [showFields, setShowFields] = useState(false)
  const isText = p.kind === 'text'
  const path = (k: string) => `positions.${p.id}.${k}`
  const bad = (k: string) => invalidPaths.has(path(k))
  const filled = posDefs.filter((d) => p.custom[d.key] !== null && p.custom[d.key] !== undefined && p.custom[d.key] !== '').length
  const fieldsInvalid = posDefs.some((d) => invalidPaths.has(path(`custom.${d.key}`)))
  const kinds: PositionKind[] = docType === 'offer' ? ['item', 'optional', 'text'] : ['item', 'text']

  const setKind = (kind: PositionKind) => {
    if (kind === p.kind) return
    if (kind === 'text') onChange({ kind, quantity: 0, unitPrice: 0, unitId: null, taxRateId: null })
    else onChange({ kind, quantity: p.quantity || 1, unitId: p.unitId ?? settings.units[0]?.id ?? null, taxRateId: p.taxRateId ?? settings.taxRates[0]?.id ?? null })
  }

  return (
    <div className={cx('pos', isText && 'pos--text', p.kind === 'optional' && 'pos--optional', smallBusiness && 'pos--no-tax')}>
      {handle ?? <span className="pos__handle" aria-hidden />}

      <div className="pos__main">
        <TitleAutocomplete
          value={p.title}
          onChange={(title) => onChange({ title })}
          onPick={(s) => onChange({
            title: s.title,
            description: s.description,
            ...(isText ? {} : {
              unitPrice: s.unitPrice,
              unitId: settings.units.some((u) => u.id === s.unitId) ? s.unitId : p.unitId,
              taxRateId: settings.taxRates.some((r) => r.id === s.taxRateId) ? s.taxRateId : p.taxRateId,
            }),
          })}
          onEnter={onEnter}
          suggestions={isText ? [] : suggestions}
          units={settings.units}
          disabled={readOnly}
          autoFocus={autoFocus}
          invalid={bad('title')}
          placeholder={isText ? 'Hinweis, z. B. „Inklusive zwei Korrekturschleifen.“' : 'Leistung, z. B. Konzeption'}
          path={path('title')}
        />
        {(!isText || p.description) && (
          <textarea className="pos__desc" rows={1} value={p.description} disabled={readOnly} placeholder="Beschreibung (optional)" aria-label="Beschreibung"
            onChange={(e) => onChange({ description: e.target.value })} />
        )}
        <div className="pos__meta">
          {p.kind === 'optional' && <span className="tag tag--neutral"><CircleDashed />Optional, nicht in der Summe</span>}
          {!isText && posDefs.length > 0 && (
            <button type="button" className={cx('pos__fields-toggle', fieldsInvalid && 'is-invalid')} aria-expanded={showFields || fieldsInvalid} onClick={() => setShowFields((v) => !v)}>
              <ListPlus />Eigene Felder <span className="num">{filled}/{posDefs.length}</span>
            </button>
          )}
        </div>
        {!isText && posDefs.length > 0 && (showFields || fieldsInvalid) && (
          <div className="pos__fields">
            {posDefs.map((d) => (
              <CustomFieldInput key={d.id} def={d} value={p.custom[d.key]} disabled={readOnly} path={path(`custom.${d.key}`)}
                onChange={(v) => onChange({ custom: { ...p.custom, [d.key]: v } })} />
            ))}
          </div>
        )}
      </div>

      {!isText && (
        <>
          <div className="pos__qty" data-path={path('quantity')}>
            <NumberInput value={p.quantity} onValue={(quantity) => onChange({ quantity })} disabled={readOnly} aria-label="Menge" className={cx(bad('quantity') && 'input--invalid')} decimals={3} />
          </div>
          <div className="pos__unit" data-path={path('unit')}>
            <select className={cx('select', bad('unit') && 'input--invalid')} value={p.unitId ?? ''} disabled={readOnly} aria-label="Einheit" onChange={(e) => onChange({ unitId: e.target.value || null })}>
              {!settings.units.some((u) => u.id === p.unitId) && <option value={p.unitId ?? ''}>{p.unitId ? 'Gelöscht' : 'Einheit'}</option>}
              {settings.units.map((u) => <option key={u.id} value={u.id}>{u.symbol}</option>)}
            </select>
          </div>
          <div className="pos__price input-group">
            <NumberInput value={p.unitPrice} onValue={(unitPrice) => onChange({ unitPrice })} disabled={readOnly} aria-label="Einzelpreis" style={{ paddingRight: '1.75rem' }} />
            <span className="input-group__suffix">€</span>
          </div>
          {!smallBusiness && (
            <div className="pos__tax" data-path={path('tax_rate')}>
              <select className={cx('select', bad('tax_rate') && 'input--invalid')} value={p.taxRateId ?? ''} disabled={readOnly} aria-label="Steuersatz" onChange={(e) => onChange({ taxRateId: e.target.value || null })}>
                {!settings.taxRates.some((r) => r.id === p.taxRateId) && <option value={p.taxRateId ?? ''}>{p.taxRateId ? 'Gelöscht' : 'Satz'}</option>}
                {settings.taxRates.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
          )}
          <div className="pos__total num" aria-label="Summe der Position">{formatMoney(net ?? 0)}</div>
        </>
      )}

      <div className="pos__menu">
        {!readOnly && (
          <Menu trigger={({ toggle, ref, open }) => (
            <Button ref={ref} variant="ghost" size="sm" iconOnly icon={<MoreHorizontal />} onClick={toggle} aria-haspopup="menu" aria-expanded={open}>Position bearbeiten</Button>
          )}>
            {(close) => (
              <>
                <div className="menu__label">Art der Position</div>
                {kinds.map((k) => (
                  <MenuItem key={k} role="menuitemradio" aria-checked={p.kind === k} icon={k === 'text' ? <AlignLeft /> : k === 'optional' ? <CircleDashed /> : <Package />} onClick={() => { setKind(k); close() }}>
                    {KIND_LABELS[k]}{p.kind === k && <><span className="spacer" /><span className="tag">aktiv</span></>}
                  </MenuItem>
                ))}
                <div className="menu__sep" />
                <MenuItem danger icon={<Trash2 />} onClick={() => { close(); onRemove() }}>Position entfernen</MenuItem>
              </>
            )}
          </Menu>
        )}
      </div>
    </div>
  )
}
