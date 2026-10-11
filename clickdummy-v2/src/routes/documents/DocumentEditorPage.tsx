import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { FileQuestion, Lock } from 'lucide-react'
import { ButtonLink, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import { buildDocumentView } from '@/domain/documentView'
import { formatDate } from '@/domain/format'
import { fieldsFor } from '@/domain/fields'
import { useCustomers } from '@/hooks/useCustomers'
import { useDocument, useDocuments, usePositionSuggestions } from '@/hooks/useDocuments'
import { useSettings } from '@/hooks/useSettings'
import { useTemplates } from '@/hooks/useTemplates'
import { useUiStore } from '@/store/ui'
import type { Customer, Document, Settings, Template } from '@/domain/types'
import { ChainBar } from './editor/ChainBar'
import { CompliancePanel } from './editor/CompliancePanel'
import { EditorHeader } from './editor/EditorHeader'
import { GroupsEditor } from './editor/GroupsEditor'
import { HeaderFields } from './editor/HeaderFields'
import { PreviewPane } from './editor/PreviewPane'
import { TextsSection } from './editor/TextsSection'
import { TotalsPanel } from './editor/TotalsPanel'
import { useDraft } from './editor/useDraft'
import './editor/editor.css'

export function DocumentEditorPage() {
  const { id } = useParams()
  const docQ = useDocument(id)
  const settingsQ = useSettings()
  const customersQ = useCustomers()
  const templatesQ = useTemplates()

  const failed = [docQ, settingsQ, customersQ, templatesQ].find((q) => q.isError)
  if (failed) {
    const notFound = failed === docQ && /gibt es nicht/.test(String(docQ.error?.message))
    if (notFound) {
      return (
        <div className="page">
          <EmptyState icon={<FileQuestion />} title="Dokument nicht gefunden" actions={<ButtonLink to="/documents" variant="primary">Zu den Dokumenten</ButtonLink>}>
            Vielleicht wurde der Entwurf gelöscht. In der Liste findest du alle Angebote und Rechnungen.
          </EmptyState>
        </div>
      )
    }
    return <div className="page"><ErrorState error={failed.error} onRetry={() => failed.refetch()} /></div>
  }
  if (!docQ.data || !settingsQ.data || !customersQ.data || !templatesQ.data) return <EditorSkeleton />

  return <Editor key={docQ.data.id} doc={docQ.data} settings={settingsQ.data} customers={customersQ.data} templates={templatesQ.data} />
}

function Editor({ doc, settings, customers, templates }: { doc: Document; settings: Settings; customers: Customer[]; templates: Template[] }) {
  const { draft, update, flush, discard, saveState } = useDraft(doc)
  const { data: list = [] } = useDocuments()
  const { data: suggestions = [] } = usePositionSuggestions()
  const previewOpen = useUiStore((s) => s.previewOpen)
  const current = draft ?? doc

  const view = useMemo(() => buildDocumentView(current, settings, customers, list), [current, settings, customers, list])
  const invalidPaths = useMemo(() => new Set(view.issues.map((i) => i.path)), [view.issues])
  const readOnly = current.status !== 'draft'
  const config = settings.docTypes[current.type]
  const posDefs = fieldsFor(settings.fieldDefs, 'position', current.type)
  // Abgeschlossene Dokumente zeigen die eingefrorenen Stammdaten
  const effectiveSettings = current.snapshot ? { ...settings, org: current.snapshot.org, taxRates: current.snapshot.taxRates, units: current.snapshot.units } : settings

  return (
    <div className={previewOpen ? 'ed ed--with-preview' : 'ed'}>
      <div className="ed__main">
        <EditorHeader doc={current} customer={view.customer} settings={settings} issues={view.issues} saveState={saveState} flush={flush} discard={discard} />
        <ChainBar id={current.id} />

        {readOnly && (
          <p className="notice notice--accent enter">
            <Lock />
            <span>
              Abgeschlossen{current.finalizedAt ? ` am ${formatDate(current.finalizedAt.slice(0, 10))}` : ''}. Das Dokument lässt sich nicht mehr ändern.
              {current.type === 'invoice' ? ' Korrekturen gehen nur über ein Storno.' : ' Für eine neue Fassung duplizierst du es.'}
              {current.cancelledById && <> Storniert durch <Link to={`/documents/${current.cancelledById}`}>das Storno</Link>.</>}
            </span>
          </p>
        )}

        <section className="ed-card">
          <HeaderFields doc={current} settings={settings} customers={customers} templates={templates} readOnly={readOnly} invalidPaths={invalidPaths} update={update} />
        </section>

        <section className="ed-card">
          <TextsSection which="intro" doc={current} blocks={settings.textBlocks} readOnly={readOnly} update={update} />
        </section>

        <section className="ed-card ed-card--positions">
          <div className="ed-card__head">
            <h2>Positionen</h2>
            {effectiveSettings.org.taxationMode === 'small_business' && <span className="tag tag--neutral">Kleinunternehmer: ohne Umsatzsteuer</span>}
          </div>
          <GroupsEditor doc={current} settings={effectiveSettings} totals={view.totals} posDefs={posDefs} readOnly={readOnly} invalidPaths={invalidPaths} suggestions={suggestions} update={update} />
          <TotalsPanel totals={view.totals} />
        </section>

        <section className="ed-card">
          <TextsSection which="closing" doc={current} blocks={settings.textBlocks} readOnly={readOnly} update={update} />
        </section>

        {!readOnly && <CompliancePanel id="check-panel" issues={view.issues} profile={config.profile} doc={current} />}
      </div>

      {previewOpen && (
        <div className="ed__preview">
          <PreviewPane input={view.contextInput} profile={config.profile} templates={templates} />
        </div>
      )}
    </div>
  )
}

function EditorSkeleton() {
  return (
    <div className="ed ed--with-preview" aria-busy="true" aria-label="Dokument wird geladen">
      <div className="ed__main">
        <div className="ed-head">
          <div className="stack stack--sm"><Skeleton w={260} h={30} /><Skeleton w={200} h={14} /></div>
          <span className="spacer" />
          <Skeleton w={130} h={38} r={999} />
        </div>
        <section className="ed-card"><div className="hf-grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="stack stack--sm"><Skeleton w={90} h={12} /><Skeleton h={38} r={12} /></div>)}</div></section>
        <section className="ed-card"><div className="stack">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} h={44} r={12} />)}</div></section>
      </div>
      <div className="ed__preview"><div className="preview"><Skeleton h={560} r={4} /></div></div>
    </div>
  )
}
