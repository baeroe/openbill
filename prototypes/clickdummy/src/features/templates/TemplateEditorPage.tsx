import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Copy, Lock } from 'lucide-react'
import { DOC_TYPE_LABELS } from '@/domain/lifecycle'
import type { Template } from '@/domain/types'
import { useDocumentStore } from '@/store/documentStore'
import { useDocumentView } from '@/store/selectors'
import { useSettingsStore } from '@/store/settingsStore'
import { useTemplateStore } from '@/store/templateStore'
import { Button } from '@/ui/Button'
import { CodeEditor, type CodeEditorHandle } from '@/ui/CodeEditor'
import { EmptyState } from '@/ui/EmptyState'
import { Select } from '@/ui/form'
import { GuidesToggle } from '@/ui/GuidesToggle'
import { PagedPreview, type Zone } from '@/ui/PagedPreview'
import { Tabs } from '@/ui/Tabs'
import { ZoneMap } from '@/ui/ZoneMap'
import { useRenderedDocument } from '../documents/useRenderedDocument'
import { missingExpectedFields } from './expectedFields'
import { FieldReference } from './FieldReference'
import { ManifestForm } from './ManifestForm'

type Tab = 'header' | 'body' | 'footer' | 'css' | 'manifest'

const TAB_ZONE: Record<Tab, Zone | null> = { header: 'header', body: 'body', footer: 'footer', css: 'body', manifest: null }
const TAB_HINT: Record<Tab, string> = {
  header: 'Wird auf jeder Seite im oberen Rand wiederholt. Eigener Kontext: Styles gehören in ein <style> in diesem Feld, Bilder als Data-URL. {{ page.number }} und {{ page.total }} funktionieren hier.',
  body: 'Der Inhalt fließt über so viele Seiten wie nötig, zwischen Kopf- und Fußzeile.',
  footer: 'Wird auf jeder Seite im unteren Rand wiederholt. Ideal für Bankdaten und „Seite {{ page.number }} von {{ page.total }}“.',
  css: 'Gilt nur für den Inhalt. Kopf- und Fußzeile bringen ihre Styles selbst mit.',
  manifest: 'Metadaten, Papierformat und die Höhen von Kopf- und Fußzeile.',
}

export function TemplateEditorPage() {
  const { id = '' } = useParams()
  const { templates, upsertTemplate, duplicateTemplate } = useTemplateStore()
  const documents = useDocumentStore((s) => s.documents)
  const settings = useSettingsStore()
  const navigate = useNavigate()
  const template = templates.find((t) => t.id === id)
  const [tab, setTab] = useState<Tab>('body')
  const [guides, setGuides] = useState(false)
  const [pages, setPages] = useState(1)
  const [sampleId, setSampleId] = useState(() => documents.find((d) => d.id === 'doc-offer-1')?.id ?? documents[0]?.id ?? '')
  const editor = useRef<CodeEditorHandle>(null)
  const view = useDocumentView(sampleId)
  const { result } = useRenderedDocument(view?.contextInput ?? null, template ?? null, 150)

  if (!template) return <EmptyState title="Template nicht gefunden" action={<Link to="/templates" className="text-carbon">Zur Übersicht</Link>} />
  const readOnly = template.builtIn
  const set = (patch: Partial<Template>) => upsertTemplate({ ...template, ...patch })
  const code = (key: 'header' | 'liquid' | 'footer' | 'css', label: string, language: 'liquid' | 'css') => (
    <CodeEditor key={key} ref={editor} ariaLabel={label} language={language} readOnly={readOnly} value={template[key]} onChange={(v) => set({ [key]: v })} />
  )

  return (
    <div className="flex h-[calc(100vh-64px)] min-h-[640px] flex-col">
      <Link to="/templates" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"><ArrowLeft size={14} /> Templates</Link>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-cond text-[28px] leading-tight font-semibold tracking-[-0.01em]">{template.manifest.name}</h1>
          <p className="text-sm text-muted">Version {template.manifest.version} von {template.manifest.author}, {template.manifest.license}</p>
        </div>
        {readOnly && (
          <div className="flex items-center gap-3 rounded-[3px] border border-line bg-sheet-2 px-3 py-2 text-sm text-muted">
            <Lock size={14} /> Mitgeliefertes Template. Zum Anpassen duplizieren.
            <Button size="sm" variant="primary" icon={<Copy size={13} />} onClick={() => navigate(`/templates/${duplicateTemplate(template.id)}`)}>Duplizieren</Button>
          </div>
        )}
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,0.85fr)]">
        <aside className="hidden min-h-0 overflow-hidden rounded-[3px] border border-line bg-sheet shadow-sheet lg:block">
          <FieldReference onInsert={(text) => editor.current?.insert(text)} />
        </aside>

        <section className="flex min-h-[420px] flex-col overflow-hidden rounded-[3px] border border-line bg-sheet shadow-sheet">
          <div className="flex items-center gap-3 border-b border-line pl-3">
            <ZoneMap active={TAB_ZONE[tab]} />
            <Tabs<Tab>
              tabs={[{ id: 'header', label: 'Kopfzeile' }, { id: 'body', label: 'Inhalt' }, { id: 'footer', label: 'Fußzeile' }, { id: 'css', label: 'CSS' }, { id: 'manifest', label: 'Manifest' }]}
              value={tab}
              onChange={setTab}
              className="-mb-px border-0"
            />
          </div>
          <p className="border-b border-line bg-sheet-2 px-4 py-2 text-xs text-muted">{TAB_HINT[tab]}</p>
          <div className="min-h-0 flex-1 overflow-auto">
            {tab === 'header' && code('header', 'Kopfzeile-Code', 'liquid')}
            {tab === 'body' && code('liquid', 'Template-Code', 'liquid')}
            {tab === 'footer' && code('footer', 'Fußzeile-Code', 'liquid')}
            {tab === 'css' && code('css', 'CSS', 'css')}
            {tab === 'manifest' && <ManifestForm manifest={template.manifest} readOnly={readOnly} missing={missingExpectedFields(template, settings)} onChange={(manifest) => set({ manifest })} />}
          </div>
        </section>

        <section className="flex min-h-0 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Select aria-label="Beispieldokument" value={sampleId} onChange={(e) => setSampleId(e.target.value)} className="h-8 text-[13px]" wrapClassName="min-w-0 flex-1">
              {documents.map((d) => <option key={d.id} value={d.id}>{DOC_TYPE_LABELS[d.type]} {d.number ?? '(Entwurf)'}</option>)}
            </Select>
            <span className="shrink-0 text-xs text-muted" data-testid="page-count">{pages === 1 ? '1 Seite' : `${pages} Seiten`}</span>
            <GuidesToggle value={guides} onChange={setGuides} />
          </div>
          {result.error && <p className="rounded-[3px] bg-danger-soft px-3 py-2 text-xs whitespace-pre-line text-danger"><b>Template-Fehler:</b> {result.error}</p>}
          <div className="min-h-0 flex-1 overflow-y-auto rounded-[3px] bg-desk">
            <PagedPreview result={result} paper={template.manifest.paper} showGuides={guides || tab === 'manifest'} highlight={TAB_ZONE[tab]} onPageCount={setPages} />
          </div>
        </section>
      </div>
    </div>
  )
}
