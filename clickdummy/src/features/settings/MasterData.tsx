import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { TAX_CATEGORY_LABELS } from '@/domain/taxCategories'
import { UNIT_CODES } from '@/domain/unitCodes'
import type { Category, TaxCategory, TaxRate, TextBlock, TextBlockKind, Unit, User } from '@/domain/types'
import { renderText } from '@/domain/liquid'
import { buildTemplateContext } from '@/domain/templateContext'
import { newId } from '@/store/ids'
import { useDocumentView } from '@/store/selectors'
import { useSettingsStore } from '@/store/settingsStore'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { Input, Select, Textarea } from '@/ui/form'
import { NumberInput } from '@/ui/NumberInput'
import { Sheet } from '@/ui/Sheet'
import { toast } from '@/ui/Toast'


function Row({ children, onEdit, onDelete, label }: { children: React.ReactNode; onEdit?(): void; onDelete(): void; label: string }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
      {children}
      <div className="ml-auto flex">
        {onEdit && <Button size="sm" variant="ghost" aria-label={`${label} bearbeiten`} onClick={onEdit} icon={<Pencil size={13} />} />}
        <Button size="sm" variant="ghost" aria-label={`${label} löschen`} onClick={onDelete} icon={<Trash2 size={13} />} />
      </div>
    </li>
  )
}

/* ---------- Steuern ---------- */

export function TaxSettings() {
  const { taxRates, upsertTaxRate, removeTaxRate, org } = useSettingsStore()
  const [edit, setEdit] = useState<TaxRate | null>(null)
  return (
    <Sheet title="Steuersätze" description="Jeder Satz trägt die Steuerkategorie, die die E-Rechnung verlangt." actions={<Button size="sm" icon={<Plus size={14} />} onClick={() => setEdit({ id: newId(), label: '', percent: 19, category: 'S', exemptionNote: null })}>Steuersatz</Button>} bodyClassName="p-0">
      {org.taxationMode === 'small_business' && <p className="border-b border-line bg-copy-yellow px-5 py-2.5 text-sm text-copy-yellow-ink">Als Kleinunternehmer werden diese Sätze aktuell nicht verwendet (§ 19 UStG).</p>}
      <ul className="divide-y divide-line">
        {taxRates.map((r) => (
          <Row key={r.id} label={r.label} onEdit={() => setEdit(r)} onDelete={() => removeTaxRate(r.id)}>
            <span className="w-20 font-medium">{r.label}</span>
            <Badge tone="carbon">{r.category}</Badge>
            <span className="text-sm text-muted">{TAX_CATEGORY_LABELS[r.category]}</span>
          </Row>
        ))}
      </ul>
      {edit && (
        <Dialog open onClose={() => setEdit(null)} title={edit.label || 'Neuer Steuersatz'} footer={<><Button onClick={() => setEdit(null)}>Abbrechen</Button><Button variant="primary" disabled={!edit.label} onClick={() => { upsertTaxRate(edit); setEdit(null) }}>Speichern</Button></>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Bezeichnung" value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} autoFocus />
            <div className="flex flex-col gap-1">
              <label htmlFor="tax-pct" className="text-[13px] font-medium text-muted">Prozent</label>
              <NumberInput id="tax-pct" decimals={1} value={edit.percent} onValue={(percent) => setEdit({ ...edit, percent })} className="h-9" />
            </div>
            <Select label="Steuerkategorie (EN 16931)" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value as TaxCategory })} wrapClassName="sm:col-span-2">
              {Object.entries(TAX_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{k}: {v}</option>)}
            </Select>
            <Input label="Hinweis bei Befreiung (optional)" value={edit.exemptionNote ?? ''} onChange={(e) => setEdit({ ...edit, exemptionNote: e.target.value || null })} wrapClassName="sm:col-span-2" />
          </div>
        </Dialog>
      )}
    </Sheet>
  )
}

/* ---------- Einheiten ---------- */

export function UnitSettings() {
  const { units, upsertUnit, removeUnit } = useSettingsStore()
  const [edit, setEdit] = useState<Unit | null>(null)
  return (
    <Sheet title="Einheiten" description="Der E-Rechnungs-Code (UN/ECE Rec. 20) ist für E-Rechnungen Pflicht." actions={<Button size="sm" icon={<Plus size={14} />} onClick={() => setEdit({ id: newId(), name: '', symbol: '', decimals: 2, code: 'C62' })}>Einheit</Button>} bodyClassName="p-0">
      <ul className="divide-y divide-line">
        {units.map((u) => (
          <Row key={u.id} label={u.name} onEdit={() => setEdit(u)} onDelete={() => removeUnit(u.id)}>
            <span className="w-28 font-medium">{u.name}</span>
            <span className="w-14 text-sm text-muted">{u.symbol}</span>
            <Badge tone="carbon">{u.code}</Badge>
            <span className="text-xs text-faint">{u.decimals} Nachkommastellen</span>
          </Row>
        ))}
      </ul>
      {edit && (
        <Dialog open onClose={() => setEdit(null)} title={edit.name || 'Neue Einheit'} footer={<><Button onClick={() => setEdit(null)}>Abbrechen</Button><Button variant="primary" disabled={!edit.name} onClick={() => { upsertUnit(edit); setEdit(null) }}>Speichern</Button></>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus />
            <Input label="Kürzel" value={edit.symbol} onChange={(e) => setEdit({ ...edit, symbol: e.target.value })} />
            <Select label="E-Rechnungs-Code" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })}>
              {UNIT_CODES.map((c) => <option key={c.code} value={c.code}>{c.code}: {c.label}</option>)}
            </Select>
            <div className="flex flex-col gap-1">
              <label htmlFor="unit-dec" className="text-[13px] font-medium text-muted">Nachkommastellen</label>
              <NumberInput id="unit-dec" decimals={0} value={edit.decimals} onValue={(d) => setEdit({ ...edit, decimals: Math.max(0, Math.min(4, Math.round(d))) })} className="h-9" />
            </div>
          </div>
        </Dialog>
      )}
    </Sheet>
  )
}

/* ---------- Kategorien ---------- */

export function CategorySettings() {
  const { categories, upsertCategory, removeCategory } = useSettingsStore()
  const [name, setName] = useState('')
  const add = () => { if (name.trim()) { upsertCategory({ id: newId(), name: name.trim() } as Category); setName('') } }
  return (
    <Sheet title="Kategorien" description="Gruppieren den Katalog und stehen im Template als {{ p.category }} bereit." bodyClassName="p-0">
      <ul className="divide-y divide-line">
        {categories.map((c) => (
          <Row key={c.id} label={c.name} onDelete={() => removeCategory(c.id)}>
            <input aria-label="Kategoriename" value={c.name} onChange={(e) => upsertCategory({ ...c, name: e.target.value })} className="min-w-0 flex-1 rounded-[3px] bg-transparent px-1 py-0.5 text-sm font-medium hover:bg-sheet-2 focus:bg-sheet-2 focus:outline-none" />
          </Row>
        ))}
      </ul>
      <form onSubmit={(e) => { e.preventDefault(); add() }} className="flex gap-2 border-t border-line bg-sheet-2 px-4 py-3">
        <Input aria-label="Neue Kategorie" placeholder="Neue Kategorie" value={name} onChange={(e) => setName(e.target.value)} wrapClassName="flex-1" className="h-8" />
        <Button size="sm" type="submit" icon={<Plus size={14} />}>Hinzufügen</Button>
      </form>
    </Sheet>
  )
}

/* ---------- Textbausteine ---------- */

const KIND_LABELS: Record<TextBlockKind, string> = { intro: 'Einleitung', closing: 'Schlusstext', payment: 'Zahlungsbedingungen', note: 'Hinweis' }

function BlockPreview({ body }: { body: string }) {
  const view = useDocumentView('doc-invoice-1')
  const ctx = useMemo(() => (view ? buildTemplateContext(view.contextInput) : null), [view])
  const [out, setOut] = useState('')
  useEffect(() => { if (ctx) renderText(body, ctx).then(setOut) }, [body, ctx])
  return <p className="rounded-[3px] bg-sheet-2 px-3 py-2 text-sm whitespace-pre-line text-muted">{out || '–'}</p>
}

export function TextBlockSettings() {
  const { textBlocks, upsertTextBlock, removeTextBlock } = useSettingsStore()
  const [edit, setEdit] = useState<TextBlock | null>(null)
  return (
    <Sheet title="Textbausteine" description="Wiederverwendbare Texte für Kopf- und Fußtext. Liquid-Platzhalter sind erlaubt." actions={<Button size="sm" icon={<Plus size={14} />} onClick={() => setEdit({ id: newId(), name: '', kind: 'note', body: '' })}>Baustein</Button>} bodyClassName="p-0">
      <ul className="divide-y divide-line">
        {textBlocks.map((b) => (
          <Row key={b.id} label={b.name} onEdit={() => setEdit(b)} onDelete={() => removeTextBlock(b.id)}>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium">{b.name} <Badge>{KIND_LABELS[b.kind]}</Badge></p>
              <p className="truncate text-xs text-muted">{b.body}</p>
            </div>
          </Row>
        ))}
      </ul>
      {edit && (
        <Dialog wide open onClose={() => setEdit(null)} title={edit.name || 'Neuer Textbaustein'} footer={<><Button onClick={() => setEdit(null)}>Abbrechen</Button><Button variant="primary" disabled={!edit.name} onClick={() => { upsertTextBlock(edit); setEdit(null) }}>Speichern</Button></>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus />
            <Select label="Art" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as TextBlockKind })}>
              {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Textarea label="Text" mono rows={5} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} wrapClassName="sm:col-span-2" hint="Beispiel: Bitte zahlen Sie bis {{ document.due_date | date }}." />
            <div className="sm:col-span-2">
              <p className="mb-1 text-[13px] font-medium text-muted">Vorschau mit Rechnung RE-0001</p>
              <BlockPreview body={edit.body} />
            </div>
          </div>
        </Dialog>
      )}
    </Sheet>
  )
}

/* ---------- Benutzer ---------- */

export function UserSettings() {
  const { users, upsertUser, removeUser } = useSettingsStore()
  const [invite, setInvite] = useState<User | null>(null)
  return (
    <Sheet title="Benutzer" description="Alle Benutzer arbeiten in derselben Organisation." actions={<Button size="sm" icon={<Plus size={14} />} onClick={() => setInvite({ id: newId(), name: '', email: '', role: 'member' })}>Einladen</Button>} bodyClassName="p-0">
      <ul className="divide-y divide-line">
        {users.map((u) => (
          <Row key={u.id} label={u.name} onDelete={() => removeUser(u.id)}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{u.name}</p>
              <p className="text-xs text-muted">{u.email}</p>
            </div>
            <Badge tone={u.role === 'owner' ? 'carbon' : 'neutral'}>{u.role === 'owner' ? 'Inhaber' : 'Mitglied'}</Badge>
          </Row>
        ))}
      </ul>
      {invite && (
        <Dialog open onClose={() => setInvite(null)} title="Benutzer einladen" footer={<><Button onClick={() => setInvite(null)}>Abbrechen</Button><Button variant="primary" disabled={!invite.email} onClick={() => { upsertUser({ ...invite, name: invite.name || invite.email }); setInvite(null); toast('Einladung angelegt. Im Klickdummy wird keine E-Mail verschickt.') }}>Einladen</Button></>}>
          <div className="grid gap-4">
            <Input label="Name" value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} autoFocus />
            <Input label="E-Mail" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
            <Select label="Rolle" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as User['role'] })}>
              <option value="member">Mitglied</option><option value="owner">Inhaber</option>
            </Select>
          </div>
        </Dialog>
      )}
    </Sheet>
  )
}
