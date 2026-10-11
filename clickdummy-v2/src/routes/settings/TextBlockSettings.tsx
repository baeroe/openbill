import { useState } from 'react'
import { Plus, TextQuote } from 'lucide-react'
import { Badge, Button, Drawer, EmptyState, ListSkeleton, Select, Textarea, TextInput } from '@/components/ui'
import type { TextBlock, TextBlockKind } from '@/domain/types'
import { useDeleteTextBlock, useSaveTextBlock, useSettings } from '@/hooks/useSettings'
import { QueryGate } from '@/layout/RouteState'
import { toast } from '@/store/toast'
import { RowActions } from './TaxUnitSettings'

const KIND_LABELS: Record<TextBlockKind, string> = { intro: 'Einleitung', closing: 'Schlusstext', payment: 'Zahlungsbedingungen', note: 'Hinweis' }
const PLACEHOLDERS = ['{{ contact.first_name }}', '{{ customer.name }}', '{{ document.number }}', '{{ document.due_date | date }}', '{{ document.gross_total | money }}']
const empty = (): TextBlock => ({ id: '', name: '', kind: 'intro', body: '' })

export function TextBlockSettings() {
  const query = useSettings()
  const [edit, setEdit] = useState<TextBlock | null>(null)
  const save = useSaveTextBlock()
  const del = useDeleteTextBlock()

  return (
    <div className="stack stack--lg enter">
      <section className="card card--flush">
        <div className="card__head settings-list-head">
          <div><h2 className="card__title">Textbausteine</h2><p className="card__desc">Wiederverwendbare Texte für Einleitung und Schlusstext. Platzhalter füllt openbill beim Einfügen aus.</p></div>
          <span className="spacer" />
          <Button size="sm" variant="soft" icon={<Plus />} onClick={() => setEdit(empty())}>Textbaustein</Button>
        </div>
        <QueryGate query={query} loading={<ListSkeleton rows={4} />}>
          {(s) => s.textBlocks.length === 0 ? (
            <EmptyState icon={<TextQuote />} title="Noch keine Textbausteine" actions={<Button variant="primary" icon={<Plus />} onClick={() => setEdit(empty())}>Textbaustein anlegen</Button>}>
              Lege zum Beispiel deine Zahlungsbedingungen einmal an und füge sie in jede Rechnung ein.
            </EmptyState>
          ) : (
            <ul className="list settings-list">
              {s.textBlocks.map((b) => {
                const usedBy = Object.values(s.docTypes).filter((c) => c.defaultIntroBlockId === b.id || c.defaultClosingBlockId === b.id)
                return (
                  <li key={b.id} className="list__row settings-row settings-row--text">
                    <button type="button" className="settings-row__main" onClick={() => setEdit(b)}>
                      <span className="list__primary">{b.name}</span>
                      <span className="list__secondary">{b.body.replace(/\n/g, ' ')}</span>
                    </button>
                    <span className="row row--wrap settings-row__value">
                      <Badge plain>{KIND_LABELS[b.kind]}</Badge>
                      {usedBy.length > 0 && <Badge plain tone="accent">Standard für {usedBy.map((c) => c.label).join(', ')}</Badge>}
                    </span>
                    <RowActions label={b.name} onEdit={() => setEdit(b)} onDelete={() => del.mutate(b.id, {
                      onSuccess: () => toast.success(`Textbaustein „${b.name}“ gelöscht`, { label: 'Rückgängig', run: () => save.mutate(b) }),
                      onError: (e) => toast.error(e.message),
                    })} />
                  </li>
                )
              })}
            </ul>
          )}
        </QueryGate>
      </section>
      {edit && <TextBlockDrawer block={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}

function TextBlockDrawer({ block, onClose }: { block: TextBlock; onClose(): void }) {
  const [b, setB] = useState(block)
  const [touched, setTouched] = useState(false)
  const save = useSaveTextBlock()
  const error = !b.name.trim() ? 'Gib dem Textbaustein einen Namen.' : !b.body.trim() ? 'Der Text ist leer.' : null
  const submit = () => {
    setTouched(true)
    if (error) return
    save.mutate(b, { onSuccess: () => { toast.success(`Textbaustein „${b.name}“ gespeichert`); onClose() }, onError: (e) => toast.error(e.message) })
  }
  return (
    <Drawer open onClose={onClose} title={block.id ? 'Textbaustein bearbeiten' : 'Textbaustein anlegen'}
      footer={<><Button variant="ghost" onClick={onClose}>Abbrechen</Button><Button variant="primary" pending={save.isPending} onClick={submit}>Speichern</Button></>}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <TextInput label="Name" value={b.name} data-autofocus placeholder="z. B. Zahlungsbedingungen 14 Tage" onChange={(e) => setB({ ...b, name: e.target.value })} />
        <Select label="Art" value={b.kind} onChange={(e) => setB({ ...b, kind: e.target.value as TextBlockKind })}>
          {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Textarea label="Text" rows={7} value={b.body} onChange={(e) => setB({ ...b, body: e.target.value })} />
        <div className="stack stack--sm">
          <span className="field__hint">Platzhalter mit Liquid, ein Klick fügt sie ans Ende an:</span>
          <div className="placeholder-chips">
            {PLACEHOLDERS.map((p) => (
              <button key={p} type="button" className="placeholder-chip" onClick={() => setB({ ...b, body: `${b.body}${b.body && !b.body.endsWith(' ') && !b.body.endsWith('\n') ? ' ' : ''}${p}` })}><code>{p}</code></button>
            ))}
          </div>
        </div>
        {touched && error && <p className="field__error" role="alert">{error}</p>}
      </form>
    </Drawer>
  )
}
