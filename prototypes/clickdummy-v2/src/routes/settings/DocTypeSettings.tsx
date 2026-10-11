import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ListPlus } from 'lucide-react'
import { Badge, Checkbox, Select, Tabs, TextInput, cx } from '@/components/ui'
import { PROFILE_DESCRIPTIONS, PROFILE_LABELS, PROFILE_TYPES } from '@/domain/compliance'
import { fieldsFor } from '@/domain/fields'
import { DOC_TYPE_LABELS } from '@/domain/lifecycle'
import { formatDocumentNumber } from '@/domain/numbering'
import { DOC_TYPES, type DocType, type DocTypeConfig, type ProfileId, type Settings } from '@/domain/types'
import { useSettings, useUpdateDocTypeConfig } from '@/hooks/useSettings'
import { useTemplates } from '@/hooks/useTemplates'
import { QueryGate } from '@/layout/RouteState'
import { toast } from '@/store/toast'
import { SaveBar } from './OrganizationSettings'
import { FormSkeleton } from './SettingsSkeleton'

const PLACEHOLDERS = [
  { token: '{YYYY}', text: 'Jahr, vierstellig' },
  { token: '{YY}', text: 'Jahr, zweistellig' },
  { token: '{MM}', text: 'Monat' },
  { token: '{0000}', text: 'Laufende Nummer, so viele Stellen wie Nullen' },
]

export function DocTypeSettings() {
  const query = useSettings()
  const [type, setType] = useState<DocType>('invoice')
  return (
    <div className="stack stack--lg">
      <Tabs<DocType> label="Dokumenttyp" value={type} onChange={setType} items={DOC_TYPES.map((t) => ({ value: t, label: DOC_TYPE_LABELS[t] }))} />
      <QueryGate query={query} loading={<FormSkeleton rows={4} />}>
        {(settings) => <DocTypeForm key={`${type}:${JSON.stringify(settings.docTypes[type])}`} settings={settings} type={type} />}
      </QueryGate>
    </div>
  )
}

function DocTypeForm({ settings, type }: { settings: Settings; type: DocType }) {
  const saved = settings.docTypes[type]
  const [cfg, setCfg] = useState<DocTypeConfig>(saved)
  const save = useUpdateDocTypeConfig()
  const templates = useTemplates()
  const dirty = useMemo(() => JSON.stringify(cfg) !== JSON.stringify(saved), [cfg, saved])
  const set = (patch: Partial<DocTypeConfig>) => setCfg((c) => ({ ...c, ...patch }))
  const setNumbering = (patch: Partial<DocTypeConfig['numbering']>) => setCfg((c) => ({ ...c, numbering: { ...c.numbering, ...patch } }))

  const profiles = (Object.keys(PROFILE_LABELS) as ProfileId[]).filter((p) => PROFILE_TYPES[p].includes(type))
  const docFields = fieldsFor(settings.fieldDefs, 'document', type)
  const posFields = fieldsFor(settings.fieldDefs, 'position', type)
  const [now] = useState(() => new Date())
  const nextSeq = cfg.numbering.resetYearly && cfg.numbering.lastYear !== null && cfg.numbering.lastYear < now.getFullYear() ? 1 : cfg.numbering.nextSeq
  const preview = formatDocumentNumber(cfg.numbering.pattern, now, nextSeq)
  const patternOk = /\{0+\}/.test(cfg.numbering.pattern)
  const blocks = (kinds: string[]) => settings.textBlocks.filter((b) => kinds.includes(b.kind))
  const tplOptions = (templates.data ?? []).filter((t) => t.manifest.documentTypes.includes(type) || t.id === cfg.templateId)

  const submit = () => {
    if (!patternOk) { toast.error('Das Muster braucht eine laufende Nummer, zum Beispiel {0000}.'); return }
    save.mutate({ type, patch: cfg }, { onSuccess: () => toast.success(`${DOC_TYPE_LABELS[type]}: Einstellungen gespeichert`), onError: (e) => toast.error(e.message) })
  }

  return (
    <form className="stack stack--lg enter" onSubmit={(e) => { e.preventDefault(); submit() }}>
      <section className="card">
        <div className="card__head"><div><h2 className="card__title">Prüfprofil</h2><p className="card__desc">Legt fest, welche Angaben vor dem Abschließen vorhanden sein müssen.</p></div></div>
        <div className="option-cards" role="radiogroup" aria-label="Prüfprofil">
          {profiles.map((p) => (
            <label key={p} className={cx('option-card', cfg.profile === p && 'option-card--on')}>
              <input type="radio" name="profile" checked={cfg.profile === p} onChange={() => set({ profile: p })} />
              <span className="option-card__title">{PROFILE_LABELS[p]}</span>
              <span className="option-card__text">{PROFILE_DESCRIPTIONS[p]}</span>
            </label>
          ))}
        </div>
        {profiles.length === 1 && <p className="field__hint" style={{ marginTop: 'var(--sp-3)' }}>Die E-Rechnung gibt es nur für Rechnungen und Stornos.</p>}
      </section>

      <section className="card">
        <div className="card__head"><div><h2 className="card__title">Nummernkreis</h2><p className="card__desc">Die Nummer wird erst beim Abschließen vergeben. Entwürfe haben noch keine.</p></div></div>
        <div className="numbering">
          <div className="stack">
            <TextInput label="Muster" value={cfg.numbering.pattern} className="input--code" error={patternOk ? undefined : 'Es fehlt die laufende Nummer, zum Beispiel {0000}.'}
              onChange={(e) => setNumbering({ pattern: e.target.value })} />
            <div className="placeholder-chips" aria-label="Platzhalter">
              {PLACEHOLDERS.map((p) => (
                <button key={p.token} type="button" className="placeholder-chip" title={p.text} onClick={() => setNumbering({ pattern: cfg.numbering.pattern + p.token })}>
                  <code>{p.token}</code><span>{p.text}</span>
                </button>
              ))}
            </div>
            <Checkbox label="Jedes Jahr wieder bei 1 anfangen" checked={cfg.numbering.resetYearly} onChange={(e) => setNumbering({ resetYearly: e.target.checked })} />
          </div>
          <div className="number-preview" aria-live="polite">
            <span className="muted">Nächste Nummer</span>
            <strong className="num">{patternOk ? preview : '–'}</strong>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card__head"><div><h2 className="card__title">Vorgaben für neue Dokumente</h2><p className="card__desc">Gilt für neu angelegte {DOC_TYPE_LABELS[type] === 'Storno' ? 'Stornos' : `Dokumente vom Typ ${DOC_TYPE_LABELS[type]}`}. Im Dokument kannst du alles ändern.</p></div></div>
        <div className="grid-2">
          <Select label="Template" value={cfg.templateId} onChange={(e) => set({ templateId: e.target.value })} disabled={templates.isPending}
            hint={templates.isError ? 'Templates konnten nicht geladen werden.' : undefined}>
            {templates.isPending && <option value={cfg.templateId}>Wird geladen …</option>}
            {tplOptions.map((t) => <option key={t.id} value={t.id}>{t.manifest.name}</option>)}
          </Select>
          {type === 'invoice' && (
            <TextInput label="Zahlungsziel" type="number" min={0} value={cfg.paymentTermDays ?? ''} aside={<span className="tag tag--neutral">Tage</span>}
              onChange={(e) => set({ paymentTermDays: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })} />
          )}
          {type === 'offer' && (
            <TextInput label="Gültig für" type="number" min={0} value={cfg.validityDays ?? ''} aside={<span className="tag tag--neutral">Tage</span>}
              onChange={(e) => set({ validityDays: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })} />
          )}
          <Select label="Einleitung" value={cfg.defaultIntroBlockId ?? ''} onChange={(e) => set({ defaultIntroBlockId: e.target.value || null })}>
            <option value="">Keine</option>
            {blocks(['intro', 'note']).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <Select label="Schlusstext" value={cfg.defaultClosingBlockId ?? ''} onChange={(e) => set({ defaultClosingBlockId: e.target.value || null })}>
            <option value="">Keiner</option>
            {blocks(['closing', 'payment', 'note']).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </div>
      </section>

      <div className="fields-hint">
        <ListPlus />
        <div className="stack stack--sm" style={{ minWidth: 0 }}>
          <span>
            <b>Eigene Felder für {DOC_TYPE_LABELS[type] === 'Storno' ? 'Stornos' : `den Typ ${DOC_TYPE_LABELS[type]}`}</b>
          </span>
          <div className="row row--wrap">
            {docFields.length + posFields.length === 0 && <span className="muted">Noch keine.</span>}
            {docFields.map((f) => <Badge key={f.id} plain>{f.label}</Badge>)}
            {posFields.map((f) => <Badge key={f.id} plain tone="accent">{f.label} · Position</Badge>)}
          </div>
        </div>
        <span className="spacer" />
        <Link to="/fields?scope=document" className="btn btn--sm btn--soft">Felder verwalten</Link>
      </div>

      <SaveBar dirty={dirty} pending={save.isPending} onReset={() => setCfg(saved)} />
    </form>
  )
}
