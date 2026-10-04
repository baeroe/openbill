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
import { SheetPreview } from '@/ui/SheetPreview'
import { Tabs } from '@/ui/Tabs'
import { useRenderedDocument } from '../documents/useRenderedDocument'
import { missingExpectedFields } from './expectedFields'
import { FieldReference } from './FieldReference'
import { ManifestForm } from './ManifestForm'

type Tab = 'liquid' | 'css' | 'manifest'

export function TemplateEditorPage() {
  const { id = '' } = useParams()
  const { templates, upsertTemplate, duplicateTemplate } = useTemplateStore()
  const documents = useDocumentStore((s) => s.documents)
  const settings = useSettingsStore()
  const navigate = useNavigate()
  const template = templates.find((t) => t.id === id)
  const [tab, setTab] = useState<Tab>('liquid')
  const [sampleId, setSampleId] = useState(() => documents.find((d) => d.id === 'doc-offer-1')?.id ?? documents[0]?.id ?? '')
  const editor = useRef<CodeEditorHandle>(null)
  const view = useDocumentView(sampleId)
  const { html, error } = useRenderedDocument(view?.contextInput ?? null, template ?? null, 150)

  if (!template) return <EmptyState title="Template nicht gefunden" action={<Link to="/templates" className="text-carbon">Zur Übersicht</Link>} />
  const readOnly = template.builtIn
  const set = (patch: Partial<Template>) => upsertTemplate({ ...template, ...patch })

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
          <Tabs<Tab> tabs={[{ id: 'liquid', label: 'Template' }, { id: 'css', label: 'CSS' }, { id: 'manifest', label: 'Manifest' }]} value={tab} onChange={setTab} className="px-3" />
          <div className="min-h-0 flex-1 overflow-auto">
            {tab === 'liquid' && <CodeEditor key="liquid" ref={editor} ariaLabel="Template-Code" language="liquid" readOnly={readOnly} value={template.liquid} onChange={(liquid) => set({ liquid })} />}
            {tab === 'css' && <CodeEditor key="css" ref={editor} ariaLabel="CSS" language="css" readOnly={readOnly} value={template.css} onChange={(css) => set({ css })} />}
            {tab === 'manifest' && <ManifestForm manifest={template.manifest} readOnly={readOnly} missing={missingExpectedFields(template, settings)} onChange={(manifest) => set({ manifest })} />}
          </div>
        </section>

        <section className="flex min-h-0 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Select aria-label="Beispieldokument" value={sampleId} onChange={(e) => setSampleId(e.target.value)} className="h-8 text-[13px]" wrapClassName="flex-1">
              {documents.map((d) => <option key={d.id} value={d.id}>{DOC_TYPE_LABELS[d.type]} {d.number ?? '(Entwurf)'}</option>)}
            </Select>
          </div>
          {error && <p className="rounded-[3px] bg-danger-soft px-3 py-2 text-xs text-danger"><b>Template-Fehler:</b> {error}</p>}
          <div className="min-h-0 flex-1 overflow-y-auto rounded-[3px] bg-desk">
            <SheetPreview html={html} />
          </div>
        </section>
      </div>
    </div>
  )
}
