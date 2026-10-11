import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowDown, ArrowUp, ChevronDown, ListPlus, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge, Button, EmptyState, ListSkeleton, PageHeader, Tabs, cx } from '@/components/ui'
import { CORE_FIELDS, FIELD_TYPE_LABELS, SCOPE_LABELS, SCOPE_LIQUID, fieldsFor, scopeHasDocTypes } from '@/domain/fields'
import { PROFILE_REQUIREMENTS } from '@/domain/compliance'
import { DOC_TYPE_LABELS, DOC_TYPE_PLURAL } from '@/domain/lifecycle'
import { DOC_TYPES, FIELD_SCOPES, type DocType, type FieldDef, type FieldScope, type Settings } from '@/domain/types'
import { useDeleteFieldDef, useReorderFieldDefs, useSaveFieldDef, useSettings } from '@/hooks/useSettings'
import { QueryGate } from '@/layout/RouteState'
import { toast } from '@/store/toast'
import { FieldDrawer } from './FieldDrawer'
import { DOC_TYPE_SHORT, SCOPE_EXAMPLES, SCOPE_INTRO, emptyFieldDef } from './shared'
import './fields.css'

const isScope = (v: string | null): v is FieldScope => !!v && (FIELD_SCOPES as string[]).includes(v)

export function FieldsPage() {
  const [params, setParams] = useSearchParams()
  const scope: FieldScope = isScope(params.get('scope')) ? (params.get('scope') as FieldScope) : 'document'
  const query = useSettings()
  const [editing, setEditing] = useState<FieldDef | null>(null)

  return (
    <div className="page">
      <PageHeader
        title="Eigene Felder"
        description="Alle zusätzlichen Felder an einem Ort. Was du hier anlegst, erscheint in den Formularen und steht in jedem Template bereit."
        actions={<Button variant="primary" icon={<Plus />} onClick={() => setEditing(emptyFieldDef(scope))}>Feld hinzufügen</Button>}
      />
      <Tabs<FieldScope>
        label="Ebene"
        value={scope}
        onChange={(s) => setParams({ scope: s }, { replace: true })}
        items={FIELD_SCOPES.map((s) => ({
          value: s,
          label: <>{SCOPE_LABELS[s]}{query.data && <span className="pill__count">{fieldsFor(query.data.fieldDefs, s).length}</span>}</>,
        }))}
      />
      <QueryGate query={query} loading={<div className="card card--flush"><ListSkeleton rows={4} /></div>}>
        {(settings) => <ScopePanel key={scope} scope={scope} settings={settings} onEdit={setEditing} />}
      </QueryGate>
      {editing && query.data && (
        <FieldDrawer def={editing} allDefs={query.data.fieldDefs} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

function ScopePanel({ scope, settings, onEdit }: { scope: FieldScope; settings: Settings; onEdit(d: FieldDef): void }) {
  const defs = fieldsFor(settings.fieldDefs, scope)
  const save = useSaveFieldDef()
  const remove = useDeleteFieldDef()
  const reorder = useReorderFieldDefs()
  const withTypes = scopeHasDocTypes(scope)

  const move = (index: number, dir: -1 | 1) => {
    const ids = defs.map((d) => d.id)
    const [id] = ids.splice(index, 1)
    ids.splice(index + dir, 0, id)
    reorder.mutate(ids, { onError: (e) => toast.error(e.message) })
  }

  const toggleType = (def: FieldDef, type: DocType) => {
    const docTypes = def.docTypes.includes(type) ? def.docTypes.filter((t) => t !== type) : DOC_TYPES.filter((t) => t === type || def.docTypes.includes(t))
    if (docTypes.length === 0) {
      toast.error('Ein Feld braucht mindestens einen Dokumenttyp. Lösche es, wenn du es nicht mehr brauchst.')
      return
    }
    save.mutate({ ...def, docTypes }, {
      onSuccess: () => toast.success(`„${def.label}“ gilt ${def.docTypes.includes(type) ? 'nicht mehr' : 'jetzt auch'} für ${DOC_TYPE_PLURAL[type]}`),
      onError: (e) => toast.error(e.message),
    })
  }

  const del = (def: FieldDef) => {
    remove.mutate(def.id, {
      onSuccess: () => toast.success(`Feld „${def.label}“ gelöscht`, { label: 'Rückgängig', run: () => save.mutate(def, { onError: (e) => toast.error(e.message) }) }),
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <div className="stack stack--lg enter">
      <div className="fields-intro">
        <p>{SCOPE_INTRO[scope]}</p>
        <p className="muted">Im Template: <code className="key">{`{{ ${SCOPE_LIQUID[scope]}.schluessel }}`}</code>{scope === 'position' && <> innerhalb von <code className="key">{'{% for p in positions %}'}</code></>}</p>
      </div>

      <section className="card card--flush" aria-label={`Eigene Felder: ${SCOPE_LABELS[scope]}`}>
        {defs.length === 0 ? (
          <EmptyState icon={<ListPlus />} title={`Noch keine eigenen Felder für ${SCOPE_LABELS[scope] === 'Ansprechpartner' ? 'Ansprechpartner' : `die Ebene ${SCOPE_LABELS[scope]}`}`}
            actions={<>
              {SCOPE_EXAMPLES[scope].map((ex) => (
                <Button key={ex.label} variant="soft" size="sm" icon={<Plus />} onClick={() => onEdit({ ...emptyFieldDef(scope), label: ex.label, type: ex.type })}>{ex.label}</Button>
              ))}
            </>}>
            Fang mit einem Vorschlag an oder lege ein eigenes Feld an.
          </EmptyState>
        ) : (
          <>
            <div className={cx('list__head fields-row', withTypes && 'fields-row--types')}>
              <span>Feld</span><span>Typ</span>{withTypes && <span>Gilt für</span>}<span className="sr-only">Aktionen</span>
            </div>
            <ul className="list fields-list">
              {defs.map((def, i) => (
                <li key={def.id} className={cx('list__row fields-row', withTypes && 'fields-row--types')}>
                  <button type="button" className="fields-row__main" onClick={() => onEdit(def)}>
                    <span className="list__primary">{def.label}{def.required && <span className="tag tag--neutral">Pflicht</span>}</span>
                    <span className="list__secondary"><code className="key">{def.key}</code>{def.help && <> · {def.help}</>}</span>
                  </button>
                  <span className="muted fields-row__type">{FIELD_TYPE_LABELS[def.type]}{def.type === 'select' && <span className="list__secondary">{def.options.length} Optionen</span>}</span>
                  {withTypes && (
                    <span className="doctype-toggles" role="group" aria-label={`${def.label} gilt für`}>
                      {DOC_TYPES.map((t) => (
                        <button key={t} type="button" className="doctype-toggle" aria-pressed={def.docTypes.includes(t)} title={DOC_TYPE_LABELS[t]}
                          disabled={save.isPending} onClick={() => toggleType(def, t)}>
                          {DOC_TYPE_SHORT[t]}
                        </button>
                      ))}
                    </span>
                  )}
                  <span className="fields-row__actions">
                    <Button variant="ghost" size="sm" iconOnly icon={<ArrowUp />} disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)}>Nach oben</Button>
                    <Button variant="ghost" size="sm" iconOnly icon={<ArrowDown />} disabled={i === defs.length - 1 || reorder.isPending} onClick={() => move(i, 1)}>Nach unten</Button>
                    <Button variant="ghost" size="sm" iconOnly icon={<Pencil />} onClick={() => onEdit(def)}>Bearbeiten</Button>
                    <Button variant="ghost" size="sm" iconOnly icon={<Trash2 />} onClick={() => del(def)}>Löschen</Button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <BuiltInFields scope={scope} settings={settings} />
    </div>
  )
}

function BuiltInFields({ scope, settings }: { scope: FieldScope; settings: Settings }) {
  const [open, setOpen] = useState(false)
  const core = CORE_FIELDS[scope]
  const reqScope = scope === 'contact' ? null : scope
  const profileReqs = reqScope ? PROFILE_REQUIREMENTS.en16931.filter((r) => r.scope === reqScope) : []
  const einvoiceTypes = DOC_TYPES.filter((t) => settings.docTypes[t].profile === 'en16931')

  return (
    <section className="builtin">
      <button type="button" className="builtin__toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Lock />
        <span><b>Eingebaute Felder</b> <span className="muted">{core.length} Kernfelder{profileReqs.length > 0 && `, ${profileReqs.length} Pflichtangaben der E-Rechnung`}</span></span>
        <ChevronDown className={cx('builtin__chev', open && 'builtin__chev--open')} />
      </button>
      {open && (
        <div className="builtin__body enter">
          <p className="muted">Diese Felder gehören fest zu openbill. Sie lassen sich nicht löschen, weil Summen, Nummern und die E-Rechnung sie brauchen.</p>
          <div className="builtin__grid">
            {core.map((f) => (
              <div key={f.key} className="builtin__item"><span>{f.label}</span><code className="key">{SCOPE_LIQUID[scope]}.{f.key}</code></div>
            ))}
          </div>
          {profileReqs.length > 0 && (
            <div className="stack stack--sm">
              <div className="row row--wrap">
                <Badge tone="accent">E-Rechnung</Badge>
                <span className="muted">
                  {einvoiceTypes.length
                    ? <>Pflicht, sobald ein Dokument mit dem Profil abgeschlossen wird. Aktiv für {einvoiceTypes.map((t) => DOC_TYPE_LABELS[t]).join(' und ')}.</>
                    : <>Derzeit nutzt kein Dokumenttyp das Profil. <Link to="/settings/doc-types">Profile einstellen</Link></>}
                </span>
              </div>
              <div className="builtin__grid">
                {profileReqs.map((r) => <div key={r.key + r.label} className="builtin__item builtin__item--req"><span>{r.label}</span><Lock /></div>)}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
