import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { AlertTriangle, ChevronLeft, Copy, Lock, PanelLeftClose, PanelLeftOpen, Save, SquareDashed } from 'lucide-react'
import { CodeEditor, type CodeEditorHandle } from '@/components/CodeEditor'
import type { Zone } from '@/components/PagedPreview'
import { Badge, Button, ButtonLink, EmptyState, ErrorState, Field, Skeleton, Tabs, type TabItem } from '@/components/ui'
import { isReservedKey } from '@/domain/fields'
import { DOC_TYPE_LABELS } from '@/domain/lifecycle'
import type { FieldDef, Template, TemplateManifest } from '@/domain/types'
import { useSettings } from '@/hooks/useSettings'
import { useDuplicateTemplate, useSaveTemplate, useTemplate } from '@/hooks/useTemplates'
import { toast } from '@/store/toast'
import { FieldSidebar } from './FieldSidebar'
import { TemplatePreview } from './TemplatePreview'
import { useSampleContext } from './useSampleContext'
import './templates.css'

type Part = 'header' | 'liquid' | 'footer' | 'css' | 'manifest'
const PARTS: TabItem<Part>[] = [
  { value: 'header', label: 'Kopfzeile' },
  { value: 'liquid', label: 'Inhalt' },
  { value: 'footer', label: 'Fußzeile' },
  { value: 'css', label: 'CSS' },
  { value: 'manifest', label: 'Manifest' },
]
const ZONE: Record<Part, Zone | null> = { header: 'header', liquid: 'body', footer: 'footer', css: null, manifest: null }
const HINTS: Record<Part, string> = {
  header: 'header.liquid: steht auf jeder Seite im oberen Rand. Eigenes <style> hier hinein, das CSS des Inhalts gilt nicht.',
  liquid: 'template.liquid: der Inhalt. Er fließt über so viele Seiten wie nötig.',
  footer: 'footer.liquid: steht auf jeder Seite im unteren Rand. {{ page.number }} und {{ page.total }} füllt der PDF-Renderer.',
  css: 'styles.css: gilt nur für den Inhalt.',
  manifest: 'manifest.json: Angaben zum Paket. Das Papierformat lässt sich auch oben im Formular ändern.',
}

export function TemplateEditorPage() {
  const { id } = useParams()
  const template = useTemplate(id)
  const settings = useSettings()

  if (template.isError) return <div className="page"><ErrorState error={template.error} onRetry={() => template.refetch()} /></div>
  if (settings.isError) return <div className="page"><ErrorState error={settings.error} onRetry={() => settings.refetch()} /></div>
  if (!template.data || !settings.data) return <EditorSkeleton />
  return <Editor key={template.data.id} initial={template.data} fieldDefs={settings.data.fieldDefs} />
}

function Editor({ initial, fieldDefs }: { initial: Template; fieldDefs: FieldDef[] }) {
  const navigate = useNavigate()
  const save = useSaveTemplate()
  const duplicate = useDuplicateTemplate()
  const [saved, setSaved] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const [part, setPart] = useState<Part>('liquid')
  const [manifestText, setManifestText] = useState(() => JSON.stringify(initial.manifest, null, 2))
  const [manifestError, setManifestError] = useState<string | null>(null)
  const [fieldsOpen, setFieldsOpen] = useState(true)
  const [sampleId, setSampleId] = useState<string>('')
  const [pages, setPages] = useState(1)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [guides, setGuides] = useState(false)
  const editor = useRef<CodeEditorHandle>(null)
  const sample = useSampleContext(sampleId)

  const readOnly = draft.builtIn
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved])

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const missingFields = useMemo(
    () => draft.manifest.expectedFields.filter((f) => !isReservedKey(f.scope, f.key) && !fieldDefs.some((d) => d.scope === f.scope && d.key === f.key)),
    [draft.manifest.expectedFields, fieldDefs],
  )

  const setManifest = (manifest: TemplateManifest) => {
    setDraft((d) => ({ ...d, manifest }))
    setManifestText(JSON.stringify(manifest, null, 2))
    setManifestError(null)
  }
  const onManifestText = (text: string) => {
    setManifestText(text)
    try {
      const parsed = JSON.parse(text) as TemplateManifest
      if (!parsed || typeof parsed !== 'object' || !parsed.paper) throw new Error('Das Manifest braucht mindestens „paper“ mit Format und Rändern.')
      setDraft((d) => ({ ...d, manifest: parsed }))
      setManifestError(null)
    } catch (e) {
      setManifestError(e instanceof Error ? e.message : String(e))
    }
  }
  const setPaper = (patch: Partial<TemplateManifest['paper']>) => setManifest({ ...draft.manifest, paper: { ...draft.manifest.paper, ...patch } })

  const onSave = () => {
    if (manifestError) { toast.error('Das Manifest enthält einen Fehler. Korrigiere es vor dem Speichern.'); setPart('manifest'); return }
    save.mutate(draft, {
      onSuccess: (t) => { setSaved(t); setDraft(t); toast.success('Template gespeichert') },
      onError: (e) => toast.error(e.message),
    })
  }
  const onDuplicate = () => duplicate.mutate(draft.id, {
    onSuccess: (copy) => { toast.success(`„${copy.manifest.name}“ angelegt`); navigate(`/templates/${copy.id}`) },
    onError: (e) => toast.error(e.message),
  })

  // ⌘S / Strg+S speichert
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (!readOnly && dirty) onSave()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const liquidPart = part === 'header' || part === 'liquid' || part === 'footer'
  const insertDisabled = readOnly ? 'Mitgelieferte Templates sind schreibgeschützt.' : !liquidPart ? 'Felder lassen sich in Kopfzeile, Inhalt und Fußzeile einfügen.' : null

  return (
    <div className="tpl-editor">
      <header className="tpl-editor__head">
        <ButtonLink to="/templates" variant="ghost" iconOnly icon={<ChevronLeft />}>Zurück zu den Templates</ButtonLink>
        <div className="tpl-editor__title">
          <h1>{draft.manifest.name || 'Ohne Namen'}</h1>
          <div className="tpl-editor__sub">
            <span className="num">Version {draft.manifest.version}</span>
            <span>von {draft.manifest.author}</span>
            {readOnly && <Badge plain><Lock size={12} aria-hidden /> Mitgeliefert, schreibgeschützt</Badge>}
            {!readOnly && dirty && <Badge tone="warn">Ungespeichert</Badge>}
          </div>
        </div>
        <span className="spacer" />
        {readOnly ? (
          <Button variant="primary" icon={<Copy />} pending={duplicate.isPending} onClick={onDuplicate}>Duplizieren, um es anzupassen</Button>
        ) : (
          <>
            {dirty && <Button variant="ghost" onClick={() => { setDraft(saved); setManifestText(JSON.stringify(saved.manifest, null, 2)); setManifestError(null) }}>Verwerfen</Button>}
            <Button variant="primary" icon={<Save />} pending={save.isPending} disabled={!dirty} onClick={onSave} title="Speichern (⌘S)">Speichern</Button>
          </>
        )}
      </header>

      <div className={fieldsOpen ? 'tpl-editor__body tpl-editor__body--fields' : 'tpl-editor__body'}>
        {fieldsOpen && (
          <section className="tpl-pane" aria-label="Verfügbare Felder">
            <div className="tpl-pane__bar">
              <span className="tpl-pane__label">Verfügbare Felder</span>
              <span className="spacer" />
              <Button size="sm" variant="ghost" iconOnly icon={<PanelLeftClose />} onClick={() => setFieldsOpen(false)}>Feldleiste einklappen</Button>
            </div>
            <FieldSidebar fieldDefs={fieldDefs} disabled={insertDisabled} onInsert={(code) => editor.current?.insert(code)} />
          </section>
        )}

        <section className="tpl-pane" aria-label="Quelltext">
          <div className="tpl-pane__bar">
            {!fieldsOpen && <Button size="sm" variant="ghost" iconOnly icon={<PanelLeftOpen />} onClick={() => setFieldsOpen(true)}>Feldleiste ausklappen</Button>}
            <Tabs<Part> label="Teil des Templates" items={PARTS} value={part} onChange={setPart} />
          </div>
          {part === 'manifest' ? (
            <div className="tpl-code tpl-manifest">
              <div className="tpl-code__hint">{HINTS.manifest}</div>
              <div>
                <div className="tpl-paper">
                  <Field label="Format">{(fid) => (
                    <select id={fid} className="select" value={draft.manifest.paper.format} disabled={readOnly} onChange={(e) => setPaper({ format: e.target.value as 'A4' | 'Letter' })}>
                      <option value="A4">A4</option><option value="Letter">Letter</option>
                    </select>
                  )}</Field>
                  <PaperInput label="Kopfzeile" value={draft.manifest.paper.headerHeight} disabled={readOnly} onChange={(v) => setPaper({ headerHeight: v })} />
                  <PaperInput label="Fußzeile" value={draft.manifest.paper.footerHeight} disabled={readOnly} onChange={(v) => setPaper({ footerHeight: v })} />
                  <PaperInput label="Rand links/rechts" value={draft.manifest.paper.marginX} disabled={readOnly} onChange={(v) => setPaper({ marginX: v })} />
                </div>
                {manifestError && <div className="notice notice--bad tpl-json-error" role="alert"><AlertTriangle /><span><b>Ungültiges Manifest:</b> {manifestError}</span></div>}
              </div>
              <div className="tpl-code__editor">
                <CodeEditor key="manifest" language="json" value={manifestText} onChange={onManifestText} readOnly={readOnly} ariaLabel="manifest.json" />
              </div>
            </div>
          ) : (
            <div className="tpl-code">
              <div className="tpl-code__hint">{HINTS[part]}</div>
              <div className="tpl-code__editor">
                <CodeEditor key={part} ref={editor} language={part === 'css' ? 'css' : 'liquid'} value={draft[part]} readOnly={readOnly}
                  ariaLabel={PARTS.find((p) => p.value === part)!.label as string}
                  onChange={(v) => setDraft((d) => ({ ...d, [part]: v }))} />
              </div>
            </div>
          )}
        </section>

        <section className="tpl-pane tpl-pane--preview" aria-label="Vorschau">
          <div className="tpl-pane__bar">
            <span className="tpl-pane__label">Vorschau</span>
            <span className="muted num" style={{ fontSize: 'var(--text-xs)' }}>{pages === 1 ? '1 Seite' : `${pages} Seiten`}</span>
            <span className="spacer" />
            <Button size="sm" variant={guides ? 'soft' : 'ghost'} icon={<SquareDashed />} aria-pressed={guides} onClick={() => setGuides((g) => !g)}>Bereiche</Button>
          </div>
          <div className="tpl-preview">
            {sample.documents.length > 0 && (
              <Field label="Beispieldokument">{(fid) => (
                <select id={fid} className="select" value={sample.sampleId ?? ''} onChange={(e) => setSampleId(e.target.value)}>
                  {sample.documents.map((d) => (
                    <option key={d.id} value={d.id}>{DOC_TYPE_LABELS[d.type]} {d.number ?? '(Entwurf)'}, {d.customerName}</option>
                  ))}
                </select>
              )}</Field>
            )}
            {missingFields.length > 0 && (
              <div className="notice notice--warn">
                <AlertTriangle />
                <span>
                  <b>Erwartete Felder fehlen:</b> {missingFields.map((f) => `${f.scope}.${f.key}`).join(', ')}. Lege sie unter „Eigene Felder“ an. Bis dahin bleiben sie im Dokument leer.
                </span>
              </div>
            )}
            {renderError && (
              <div className="notice notice--bad tpl-error" role="alert"><AlertTriangle /><span><b>Template-Fehler.</b> {renderError}</span></div>
            )}
            {sample.error ? (
              <ErrorState error={sample.error} onRetry={sample.retry} />
            ) : sample.isEmpty ? (
              <EmptyState icon={<SquareDashed />} title="Kein Beispieldokument">Lege ein Dokument an, um das Template mit echten Daten zu sehen.</EmptyState>
            ) : (
              <TemplatePreview template={draft} input={sample.input} highlight={ZONE[part]} showGuides={guides} onPageCount={setPages} onError={setRenderError} />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function PaperInput({ label, value, onChange, disabled }: { label: string; value: string; onChange(v: string): void; disabled: boolean }) {
  const valid = /^\s*[\d.]+\s*(mm|cm|in|pt|px)\s*$/.test(value)
  return (
    <Field label={label} error={valid ? undefined : 'z. B. 20mm'}>{(fid) => (
      <input id={fid} className={valid ? 'input' : 'input input--invalid'} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    )}</Field>
  )
}

function EditorSkeleton() {
  return (
    <div className="tpl-editor" aria-busy="true" aria-label="Template wird geladen">
      <div className="tpl-editor__head"><Skeleton w={36} h={36} r={999} /><div className="stack stack--sm"><Skeleton w={220} h={24} /><Skeleton w={140} h={12} /></div></div>
      <div className="tpl-editor__body tpl-editor__body--fields">
        <div className="tpl-pane"><div className="stack" style={{ padding: 'var(--sp-4)' }}>{Array.from({ length: 10 }, (_, i) => <Skeleton key={i} h={14} w={`${50 + ((i * 13) % 40)}%`} />)}</div></div>
        <div className="tpl-pane"><Skeleton h="100%" r={12} /></div>
        <div className="tpl-pane"><div style={{ padding: 'var(--sp-5)' }}><Skeleton h={420} r={4} /></div></div>
      </div>
    </div>
  )
}
