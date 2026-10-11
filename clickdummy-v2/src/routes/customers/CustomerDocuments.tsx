import { Link } from 'react-router'
import { FilePlus, FileText } from 'lucide-react'
import { Button, ErrorState, Skeleton, StatusBadge } from '@/components/ui'
import { formatDate, formatMoney } from '@/domain/format'
import { DOC_TYPE_LABELS } from '@/domain/lifecycle'
import { useDocuments } from '@/hooks/useDocuments'

export function CustomerDocuments({ customerId, onNew }: { customerId: string; onNew(): void }) {
  const docs = useDocuments({ customerId })
  return (
    <section className="card" aria-labelledby="cust-docs-title">
      <div className="card__head">
        <div>
          <h2 className="card__title" id="cust-docs-title">Dokumente</h2>
          {docs.data && docs.data.length > 0 && <p className="card__desc">{docs.data.length === 1 ? '1 Dokument' : `${docs.data.length} Dokumente`}</p>}
        </div>
        <span className="spacer" />
        <Button size="sm" variant="soft" icon={<FilePlus />} onClick={onNew}>Neu</Button>
      </div>
      {docs.isError ? (
        <ErrorState error={docs.error} onRetry={() => docs.refetch()} />
      ) : !docs.data ? (
        <div className="stack stack--sm" aria-busy="true" aria-label="Dokumente werden geladen">
          {Array.from({ length: 3 }, (_, i) => <div key={i} className="row" style={{ padding: 'var(--sp-3)' }}><Skeleton w="55%" h={13} /><span className="spacer" /><Skeleton w={70} h={13} /></div>)}
        </div>
      ) : docs.data.length === 0 ? (
        <div className="state" style={{ padding: 'var(--sp-6) var(--sp-4)' }}>
          <div className="state__icon"><FileText /></div>
          <p>Für diesen Kunden gibt es noch keine Dokumente.</p>
          <div className="row"><Button size="sm" variant="primary" icon={<FilePlus />} onClick={onNew}>Dokument anlegen</Button></div>
        </div>
      ) : (
        <div className="stack stack--sm" style={{ gap: 2, margin: '0 calc(var(--sp-3) * -1)' }}>
          {docs.data.map((d) => (
            <Link key={d.id} to={`/documents/${d.id}`} className="cust-doc">
              <span className="cust-doc__title">{DOC_TYPE_LABELS[d.type]} {d.number ?? '(Entwurf)'}</span>
              <span className="cust-doc__amount">{formatMoney(d.gross)}</span>
              <span className="cust-doc__meta">{d.projectName ? `${d.projectName} · ` : ''}{formatDate(d.date)}</span>
              <span style={{ justifySelf: 'end' }}><StatusBadge status={d.status} overdue={d.overdue} /></span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
