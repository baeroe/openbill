import { useState } from 'react'
import { Pencil, Percent, Plus, Ruler, Trash2 } from 'lucide-react'
import { Badge, Button, Drawer, EmptyState, ListSkeleton, NumberInput, Select, TextInput, Textarea, Field } from '@/components/ui'
import { TAX_CATEGORY_LABELS } from '@/domain/taxCategories'
import { UNIT_CODES } from '@/domain/unitCodes'
import type { TaxCategory, TaxRate, Unit } from '@/domain/types'
import { useDeleteTaxRate, useDeleteUnit, useSaveTaxRate, useSaveUnit, useSettings } from '@/hooks/useSettings'
import { QueryGate } from '@/layout/RouteState'
import { toast } from '@/store/toast'

const emptyRate = (): TaxRate => ({ id: '', label: '', percent: 19, category: 'S', exemptionNote: null })
const emptyUnit = (): Unit => ({ id: '', name: '', symbol: '', decimals: 2, code: '' })

export function TaxUnitSettings() {
  const query = useSettings()
  const [rate, setRate] = useState<TaxRate | null>(null)
  const [unit, setUnit] = useState<Unit | null>(null)
  const saveRate = useSaveTaxRate()
  const delRate = useDeleteTaxRate()
  const saveUnit = useSaveUnit()
  const delUnit = useDeleteUnit()
  const loading = <div className="card card--flush"><ListSkeleton rows={3} /></div>

  return (
    <div className="stack stack--lg enter">
      <section className="card card--flush">
        <div className="card__head settings-list-head">
          <div><h2 className="card__title">Steuersätze</h2><p className="card__desc">Jeder Satz trägt die Steuerkategorie, die die E-Rechnung verlangt.</p></div>
          <span className="spacer" />
          <Button size="sm" variant="soft" icon={<Plus />} onClick={() => setRate(emptyRate())}>Steuersatz</Button>
        </div>
        <QueryGate query={query} loading={loading}>
          {(s) => s.taxRates.length === 0 ? (
            <EmptyState icon={<Percent />} title="Keine Steuersätze" actions={<Button variant="primary" icon={<Plus />} onClick={() => setRate(emptyRate())}>Steuersatz anlegen</Button>}>
              Ohne Steuersatz kannst du in der Regelbesteuerung keine Positionen abrechnen.
            </EmptyState>
          ) : (
            <ul className="list settings-list">
              {s.taxRates.map((r) => (
                <li key={r.id} className="list__row settings-row">
                  <button type="button" className="settings-row__main" onClick={() => setRate(r)}>
                    <span className="list__primary">{r.label}</span>
                    <span className="list__secondary">{r.exemptionNote ?? TAX_CATEGORY_LABELS[r.category]}</span>
                  </button>
                  <span className="num settings-row__value">{r.percent.toLocaleString('de-DE')} %</span>
                  <Badge plain tone="neutral">{r.category}</Badge>
                  <RowActions label={r.label} onEdit={() => setRate(r)} onDelete={() => delRate.mutate(r.id, {
                    onSuccess: () => toast.success(`Steuersatz ${r.label} gelöscht`, { label: 'Rückgängig', run: () => saveRate.mutate(r) }),
                    onError: (e) => toast.error(e.message),
                  })} />
                </li>
              ))}
            </ul>
          )}
        </QueryGate>
      </section>

      <section className="card card--flush">
        <div className="card__head settings-list-head">
          <div><h2 className="card__title">Einheiten</h2><p className="card__desc">Der Code nach UN/ECE Rec. 20 landet in der E-Rechnung.</p></div>
          <span className="spacer" />
          <Button size="sm" variant="soft" icon={<Plus />} onClick={() => setUnit(emptyUnit())}>Einheit</Button>
        </div>
        <QueryGate query={query} loading={loading}>
          {(s) => s.units.length === 0 ? (
            <EmptyState icon={<Ruler />} title="Keine Einheiten" actions={<Button variant="primary" icon={<Plus />} onClick={() => setUnit(emptyUnit())}>Einheit anlegen</Button>}>
              Lege mindestens Stunde, Tag oder Pauschal an.
            </EmptyState>
          ) : (
            <ul className="list settings-list">
              {s.units.map((u) => (
                <li key={u.id} className="list__row settings-row">
                  <button type="button" className="settings-row__main" onClick={() => setUnit(u)}>
                    <span className="list__primary">{u.name}</span>
                    <span className="list__secondary">Kürzel „{u.symbol}“, {u.decimals} Nachkommastellen</span>
                  </button>
                  <span className="settings-row__value">{u.code ? <code className="key">{u.code}</code> : <Badge tone="warn">Kein Code</Badge>}</span>
                  <span />
                  <RowActions label={u.name} onEdit={() => setUnit(u)} onDelete={() => delUnit.mutate(u.id, {
                    onSuccess: () => toast.success(`Einheit ${u.name} gelöscht`, { label: 'Rückgängig', run: () => saveUnit.mutate(u) }),
                    onError: (e) => toast.error(e.message),
                  })} />
                </li>
              ))}
            </ul>
          )}
        </QueryGate>
      </section>

      {rate && <RateDrawer rate={rate} onClose={() => setRate(null)} />}
      {unit && <UnitDrawer unit={unit} onClose={() => setUnit(null)} />}
    </div>
  )
}

export function RowActions({ label, onEdit, onDelete }: { label: string; onEdit(): void; onDelete(): void }) {
  return (
    <span className="settings-row__actions">
      <Button variant="ghost" size="sm" iconOnly icon={<Pencil />} onClick={onEdit}>{`${label} bearbeiten`}</Button>
      <Button variant="ghost" size="sm" iconOnly icon={<Trash2 />} onClick={onDelete}>{`${label} löschen`}</Button>
    </span>
  )
}

function RateDrawer({ rate, onClose }: { rate: TaxRate; onClose(): void }) {
  const [r, setR] = useState(rate)
  const [touched, setTouched] = useState(false)
  const save = useSaveTaxRate()
  const exempt = r.percent === 0
  const error = !r.label.trim() ? 'Gib dem Steuersatz eine Bezeichnung.' : null
  const submit = () => {
    setTouched(true)
    if (error) return
    save.mutate({ ...r, exemptionNote: r.exemptionNote?.trim() || null }, { onSuccess: () => { toast.success(`Steuersatz ${r.label} gespeichert`); onClose() }, onError: (e) => toast.error(e.message) })
  }
  return (
    <Drawer open onClose={onClose} title={rate.id ? 'Steuersatz bearbeiten' : 'Steuersatz anlegen'}
      footer={<><Button variant="ghost" onClick={onClose}>Abbrechen</Button><Button variant="primary" pending={save.isPending} onClick={submit}>Speichern</Button></>}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <TextInput label="Bezeichnung" value={r.label} data-autofocus placeholder="z. B. 19 %" error={touched ? error : undefined} onChange={(e) => setR({ ...r, label: e.target.value })} />
        <Field label="Prozentsatz">
          {(id) => <div className="input-group"><NumberInput id={id} value={r.percent} decimals={2} onValue={(n) => setR({ ...r, percent: n })} style={{ paddingRight: '2rem' }} /><span className="input-group__suffix">%</span></div>}
        </Field>
        <Select label="Steuerkategorie (EN 16931)" value={r.category} onChange={(e) => setR({ ...r, category: e.target.value as TaxCategory })}>
          {Object.entries(TAX_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{k}: {v}</option>)}
        </Select>
        <Textarea label="Hinweis bei Befreiung" rows={2} value={r.exemptionNote ?? ''} placeholder={exempt ? 'z. B. Steuerfreie Leistung nach § 4 UStG' : 'Nur bei 0 % nötig'}
          hint="Erscheint als gesetzlicher Hinweis auf dem Dokument." onChange={(e) => setR({ ...r, exemptionNote: e.target.value })} />
      </form>
    </Drawer>
  )
}

function UnitDrawer({ unit, onClose }: { unit: Unit; onClose(): void }) {
  const [u, setU] = useState(unit)
  const [touched, setTouched] = useState(false)
  const save = useSaveUnit()
  const error = !u.name.trim() ? 'Gib der Einheit einen Namen.' : !u.symbol.trim() ? 'Gib ein Kürzel an.' : null
  const submit = () => {
    setTouched(true)
    if (error) return
    save.mutate(u, { onSuccess: () => { toast.success(`Einheit ${u.name} gespeichert`); onClose() }, onError: (e) => toast.error(e.message) })
  }
  return (
    <Drawer open onClose={onClose} title={unit.id ? 'Einheit bearbeiten' : 'Einheit anlegen'}
      footer={<><Button variant="ghost" onClick={onClose}>Abbrechen</Button><Button variant="primary" pending={save.isPending} onClick={submit}>Speichern</Button></>}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <div className="grid-2">
          <TextInput label="Name" value={u.name} data-autofocus placeholder="Stunde" onChange={(e) => setU({ ...u, name: e.target.value })} />
          <TextInput label="Kürzel" value={u.symbol} placeholder="Std." onChange={(e) => setU({ ...u, symbol: e.target.value })} />
        </div>
        <TextInput label="Nachkommastellen" type="number" min={0} max={4} value={u.decimals} onChange={(e) => setU({ ...u, decimals: Math.min(4, Math.max(0, Number(e.target.value))) })} />
        <Select label="Code für die E-Rechnung" value={u.code} hint="UN/ECE Recommendation 20. Ohne Code lässt sich keine E-Rechnung abschließen." onChange={(e) => setU({ ...u, code: e.target.value })}>
          <option value="">Kein Code</option>
          {UNIT_CODES.map((c) => <option key={c.code} value={c.code}>{c.code}: {c.label}</option>)}
          {u.code && !UNIT_CODES.some((c) => c.code === u.code) && <option value={u.code}>{u.code}</option>}
        </Select>
        {touched && error && <p className="field__error" role="alert">{error}</p>}
      </form>
    </Drawer>
  )
}
