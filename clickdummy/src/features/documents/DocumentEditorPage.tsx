import { Link, useParams } from 'react-router'
import { ArrowLeft, Lock } from 'lucide-react'
import { formatDate } from '@/domain/format'
import { DOC_TYPE_LABELS, isLocked, isOverdue } from '@/domain/lifecycle'
import { todayIso } from '@/domain/dates'
import { useDocumentView } from '@/store/selectors'
import { StatusBadge } from '@/ui/Badge'
import { EmptyState } from '@/ui/EmptyState'
import { CompliancePanel } from './CompliancePanel'
import { DocumentActions } from './DocumentActions'
import { DocumentChain } from './DocumentChain'
import { DocumentHeaderFields } from './DocumentHeaderFields'
import { DocumentPreviewPane } from './DocumentPreviewPane'
import { PositionsTable } from './PositionsTable'
import { TextsSection } from './TextsSection'
import { TotalsPanel } from './TotalsPanel'

export function DocumentEditorPage() {
  const { id = '' } = useParams()
  const view = useDocumentView(id)
  if (!view) return <EmptyState title="Dokument nicht gefunden" text="Vielleicht wurde der Entwurf gelöscht." action={<Link to="/documents" className="text-carbon">Zur Dokumentliste</Link>} />

  const { doc, config, customer, totals, issues, contextInput } = view
  const locked = isLocked(doc)

  return (
    <div className="mx-auto max-w-[1600px]">
      <Link to="/documents" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} /> Dokumente
      </Link>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{DOC_TYPE_LABELS[doc.type]}{customer && ` für ${customer.name}`}</p>
          <div className="flex items-center gap-3">
            <h1 className="font-cond text-[28px] leading-tight font-semibold tracking-[-0.01em]">{doc.number ?? 'Entwurf'}</h1>
            <StatusBadge status={doc.status} overdue={isOverdue(doc, todayIso())} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2"><DocumentActions doc={doc} issues={issues} /></div>
      </header>

      {locked && (
        <p className="mb-5 flex items-center gap-2 rounded-[3px] border border-line bg-sheet-2 px-4 py-2.5 text-sm text-muted">
          <Lock size={14} />
          Abgeschlossen am {formatDate(doc.finalizedAt?.slice(0, 10))}. {doc.type === 'invoice' ? 'Änderungen gehen nur noch über ein Storno.' : 'Das Dokument ist nicht mehr änderbar.'}
        </p>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_520px]">
        <div className="flex min-w-0 flex-col gap-5">
          <DocumentHeaderFields doc={doc} config={config} customer={customer} locked={locked} />
          <PositionsTable doc={doc} config={config} customer={customer} totals={totals} locked={locked} />
          <TotalsPanel totals={totals} />
          <TextsSection doc={doc} locked={locked} />
        </div>
        <aside className="flex flex-col gap-4 xl:sticky xl:top-6">
          <CompliancePanel issues={issues} profile={config.profile} customer={customer} locked={locked} />
          <DocumentChain doc={doc} />
          <DocumentPreviewPane input={contextInput} profile={config.profile} />
        </aside>
      </div>
    </div>
  )
}
