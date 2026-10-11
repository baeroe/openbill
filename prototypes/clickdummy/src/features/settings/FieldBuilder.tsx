import { useState } from 'react'
import { ArrowDown, ArrowUp, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { FIELD_TYPE_LABELS, slugifyKey } from '@/domain/fields'
import type { FieldDef, FieldType } from '@/domain/types'
import { newId } from '@/store/ids'
import { getFieldDefs, useSettingsStore, type FieldTarget } from '@/store/settingsStore'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { Checkbox, Input, Select, Textarea } from '@/ui/form'
import { Sheet } from '@/ui/Sheet'

export interface CoreField { key: string; label: string; profile?: boolean }

function FieldDialog({ target, def, isNew, onClose }: { target: FieldTarget; def: FieldDef; isNew: boolean; onClose(): void }) {
  const upsert = useSettingsStore((s) => s.upsertFieldDef)
  const [d, setD] = useState(def)
  const [keyTouched, setKeyTouched] = useState(!isNew)
  const [errors, setErrors] = useState<string[]>([])
  const set = (patch: Partial<FieldDef>) => setD({ ...d, ...patch })

  const save = () => {
    const errs = upsert(target, { ...d, options: d.options.map((o) => o.trim()).filter(Boolean) })
    if (errs.length) setErrors(errs)
    else onClose()
  }

  return (
    <Dialog open onClose={onClose} title={isNew ? 'Feld hinzufügen' : `Feld „${def.label}“`} footer={<><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" onClick={save}>Speichern</Button></>}>
      <div className="grid gap-4">
        <Input label="Bezeichnung" autoFocus value={d.label} onChange={(e) => set({ label: e.target.value, ...(keyTouched ? {} : { key: slugifyKey(e.target.value) }) })} />
        <Input
          label="Schlüssel"
          mono
          disabled={!isNew}
          hint={isNew ? 'So greifst du im Template darauf zu. Nach dem Speichern nicht mehr änderbar.' : 'Fest, damit Templates nicht brechen.'}
          value={d.key}
          onChange={(e) => { setKeyTouched(true); set({ key: e.target.value }) }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Typ" value={d.type} onChange={(e) => set({ type: e.target.value as FieldType })}>
            {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Checkbox label="Pflichtfeld" hint="Muss vor dem Abschließen ausgefüllt sein." checked={d.required} onChange={(e) => set({ required: e.target.checked })} className="pt-6" />
        </div>
        {d.type === 'select' && (
          <Textarea label="Optionen" hint="Eine Option pro Zeile." rows={4} value={d.options.join('\n')} onChange={(e) => set({ options: e.target.value.split('\n') })} />
        )}
        <Input label="Hilfetext (optional)" value={d.help} onChange={(e) => set({ help: e.target.value })} />
        {errors.length > 0 && (
          <ul className="rounded-[3px] bg-danger-soft px-3 py-2 text-sm text-danger">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        )}
      </div>
    </Dialog>
  )
}

/** Verwaltet die eigenen Felder einer Ebene; Kern- und Profilfelder werden gesperrt angezeigt. */
export function FieldBuilder({ target, title, description, core = [], addLabel = 'Feld hinzufügen', prefix }: {
  target: FieldTarget
  title: string
  description?: string
  core?: CoreField[]
  addLabel?: string
  prefix: string
}) {
  const settings = useSettingsStore()
  const defs = getFieldDefs(settings, target)
  const [editing, setEditing] = useState<{ def: FieldDef; isNew: boolean } | null>(null)
  const add = () => setEditing({ isNew: true, def: { id: newId(), key: '', label: '', type: 'text', required: false, defaultValue: null, help: '', options: [] } })

  return (
    <Sheet title={title} description={description} actions={<Button size="sm" icon={<Plus size={14} />} onClick={add}>{addLabel}</Button>}>
      {core.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {core.map((c) => (
            <span key={c.key} title={`{{ ${prefix}.${c.key} }}`} className="inline-flex items-center gap-1.5 rounded-[3px] border border-line bg-sheet-2 px-2 py-1 text-xs text-muted">
              <Lock size={11} /> {c.label}
              {c.profile && <Badge tone="carbon" className="h-4 px-1 text-[10px]">E-Rechnung</Badge>}
            </span>
          ))}
        </div>
      )}
      {defs.length === 0 ? (
        <p className="text-sm text-muted">Noch keine eigenen Felder.</p>
      ) : (
        <ul className="divide-y divide-line rounded-[3px] border border-line">
          {defs.map((d, i) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <div className="min-w-40 flex-1">
                <p className="text-sm font-medium">{d.label}{d.required && <span className="text-danger">*</span>}</p>
                <p className="font-mono text-[11.5px] text-faint">{`{{ ${prefix}.${d.key} }}`}</p>
              </div>
              <Badge>{FIELD_TYPE_LABELS[d.type]}</Badge>
              <div className="flex">
                <Button size="sm" variant="ghost" aria-label="Nach oben" disabled={i === 0} onClick={() => settings.moveFieldDef(target, i, i - 1)} icon={<ArrowUp size={13} />} />
                <Button size="sm" variant="ghost" aria-label="Nach unten" disabled={i === defs.length - 1} onClick={() => settings.moveFieldDef(target, i, i + 1)} icon={<ArrowDown size={13} />} />
                <Button size="sm" variant="ghost" aria-label={`${d.label} bearbeiten`} onClick={() => setEditing({ def: d, isNew: false })} icon={<Pencil size={13} />} />
                <Button size="sm" variant="ghost" aria-label={`${d.label} löschen`} onClick={() => settings.removeFieldDef(target, d.id)} icon={<Trash2 size={13} />} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <FieldDialog target={target} def={editing.def} isNew={editing.isNew} onClose={() => setEditing(null)} />}
    </Sheet>
  )
}
