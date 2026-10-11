import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { FileText, Plus, Search, SearchX } from 'lucide-react'
import type { DocumentFilter, DocumentSummary } from '@/api/documents'
import { Button, EmptyState, ErrorState, ListSkeleton, PageHeader, StatusBadge } from '@/components/ui'
import { formatDate, formatMoney } from '@/domain/format'
import { DOC_TYPE_LABELS } from '@/domain/lifecycle'
import type { DocStatus, DocType } from '@/domain/types'
import { useCustomers } from '@/hooks/useCustomers'
import { useDocuments } from '@/hooks/useDocuments'
import { NewDocumentDialog } from './NewDocumentDialog'
import './DocumentListPage.css'

const TYPE_PILLS: { value: DocType | ''; label: string }[] = [
  { value: '', label: 'Alle' },
  { value: 'offer', label: 'Angebote' },
  { value: 'confirmation', label: 'Auftragsbestätigungen' },
  { value: 'invoice', label: 'Rechnungen' },
  { value: 'cancellation', label: 'Stornos' },
]

const STATUS_OPTIONS: { value: DocStatus | 'overdue'; label: string }[] = [
  { value: 'draft', label: 'Entwurf' },
  { value: 'open', label: 'Offen' },
  { value: 'overdue', label: 'Überfällig' },
  { value: 'accepted', label: 'Angenommen' },
  { value: 'rejected', label: 'Abgelehnt' },
  { value: 'done', label: 'Erledigt' },
  { value: 'paid', label: 'Bezahlt' },
  { value: 'cancelled', label: 'Storniert' },
  { value: 'closed', label: 'Abgeschlossen' },
]

const monthLabel = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })

export function DocumentListPage() {
  const [params, setParams] = useSearchParams()
  const [newOpen, setNewOpen] = useState(false)
  const type = (params.get('type') ?? '') as DocType | ''
  const status = (params.get('status') ?? '') as DocumentFilter['status'] | ''
  const customerId = params.get('customer') ?? ''
  const query = params.get('q') ?? ''

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const filtered = !!(type || status || customerId || query)

  // Ohne Typ-Filter laden, damit die Pillen ihre Anzahl zeigen; der Typ wird lokal gefiltert.
  const docs = useDocuments({ status: status || undefined, customerId: customerId || undefined, query: query || undefined })
  const customers = useCustomers()

  const counts = useMemo(() => {
    const c: Record<string, number> = { '': docs.data?.length ?? 0 }
    for (const d of docs.data ?? []) c[d.type] = (c[d.type] ?? 0) + 1
    return c
  }, [docs.data])
  const rows = useMemo(() => (docs.data ?? []).filter((d) => !type || d.type === type), [docs.data, type])
  const groups = useMemo(() => groupByMonth(rows), [rows])
  const total = rows.reduce((s, d) => s + d.gross, 0)

  return (
    <div className="page">
      <PageHeader title="Dokumente" description="Angebote, Auftragsbestätigungen, Rechnungen und Stornos an einem Ort."
        actions={<Button variant="primary" icon={<Plus />} onClick={() => setNewOpen(true)}>Neues Dokument</Button>} />

      <div className="dl-filters">
        <div className="pills" role="group" aria-label="Nach Art filtern">
          {TYPE_PILLS.map((p) => (
            <button key={p.value} type="button" className="pill" aria-pressed={type === p.value} onClick={() => set('type', p.value)}>
              {p.label}<span className="pill__count">{counts[p.value] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="dl-filters__row">
          <div className="input-group dl-search">
            <Search />
            <input className="input" type="search" placeholder="Nummer, Kunde oder Projekt" value={query} onChange={(e) => set('q', e.target.value)} aria-label="Dokumente durchsuchen" />
          </div>
          <select className="select dl-select" value={status} onChange={(e) => set('status', e.target.value)} aria-label="Nach Status filtern">
            <option value="">Jeder Status</option>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className="select dl-select" value={customerId} onChange={(e) => set('customer', e.target.value)} aria-label="Nach Kunde filtern">
            <option value="">Alle Kunden</option>
            {customers.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {filtered && <Button variant="ghost" size="sm" onClick={() => setParams({}, { replace: true })}>Filter zurücksetzen</Button>}
        </div>
      </div>

      <section className="card card--flush dl-card" aria-busy={docs.isFetching}>
        {docs.isError ? (
          <ErrorState error={docs.error} onRetry={() => docs.refetch()} />
        ) : docs.isPending ? (
          <ListSkeleton rows={7} />
        ) : rows.length === 0 ? (
          filtered ? (
            <EmptyState icon={<SearchX />} title="Keine Dokumente gefunden" actions={<Button onClick={() => setParams({}, { replace: true })}>Filter zurücksetzen</Button>}>
              Zu diesen Filtern passt kein Dokument. Lockere die Suche oder setze die Filter zurück.
            </EmptyState>
          ) : (
            <EmptyState icon={<FileText />} title="Noch keine Dokumente" actions={<Button variant="primary" icon={<Plus />} onClick={() => setNewOpen(true)}>Erstes Dokument anlegen</Button>}>
              Leg ein Angebot oder eine Rechnung an. Nummern vergibt openbill beim Abschließen.
            </EmptyState>
          )
        ) : (
          <div className="enter">
            <div className="list__head dl-grid" aria-hidden>
              <span>Nummer</span><span>Kunde und Projekt</span><span>Datum</span><span>Fällig / gültig bis</span><span>Status</span><span className="dl-amount">Betrag</span>
            </div>
            {groups.map((g) => (
              <section key={g.key} aria-label={g.label}>
                <h2 className="dl-month">{g.label}</h2>
                <div className="list">
                  {g.items.map((d) => <DocumentRow key={d.id} d={d} />)}
                </div>
              </section>
            ))}
            <div className="dl-foot">
              <span>{rows.length === 1 ? '1 Dokument' : `${rows.length} Dokumente`}</span>
              <span className="num">Summe {formatMoney(total)}</span>
            </div>
          </div>
        )}
      </section>

      <NewDocumentDialog open={newOpen} onClose={() => setNewOpen(false)} type={type && type !== 'cancellation' ? type : undefined} customerId={customerId || undefined} />
    </div>
  )
}

function DocumentRow({ d }: { d: DocumentSummary }) {
  const deadline = d.type === 'invoice' ? d.dueDate : d.type === 'offer' ? d.validUntil : null
  return (
    <Link to={`/documents/${d.id}`} className="list__row dl-grid">
      <span className="dl-number">
        <span className={d.number ? 'num' : 'dl-draft'}>{d.number ?? 'Entwurf'}</span>
        <span className="list__secondary">{DOC_TYPE_LABELS[d.type]}</span>
      </span>
      <span className="dl-who">
        <span className="list__primary">{d.customerName}</span>
        <span className="list__secondary">{d.projectName ?? 'Ohne Projekt'}</span>
      </span>
      <span className="dl-date num">{formatDate(d.date)}</span>
      <span className={d.overdue ? 'dl-date num dl-date--late' : 'dl-date num'}>{deadline ? formatDate(deadline) : <span className="muted">–</span>}</span>
      <span><StatusBadge status={d.status} overdue={d.overdue} /></span>
      <span className="dl-amount num">{formatMoney(d.gross)}</span>
    </Link>
  )
}

function groupByMonth(rows: DocumentSummary[]) {
  const map = new Map<string, { key: string; label: string; items: DocumentSummary[] }>()
  for (const d of rows) {
    const key = d.date.slice(0, 7)
    if (!map.has(key)) map.set(key, { key, label: monthLabel.format(new Date(`${key}-01T00:00:00`)), items: [] })
    map.get(key)!.items.push(d)
  }
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key))
}
