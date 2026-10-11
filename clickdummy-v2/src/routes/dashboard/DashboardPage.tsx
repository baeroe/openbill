import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AlarmClock, ArrowUpRight, CircleCheck, FilePen, FilePlus2, FileText, Hourglass } from 'lucide-react'
import type { DocumentSummary } from '@/api/documents'
import { Button, EmptyState, ErrorState, Skeleton, StatusBadge } from '@/components/ui'
import { addDays, todayIso } from '@/domain/dates'
import { formatDate, formatMoney } from '@/domain/format'
import { DOC_TYPE_LABELS } from '@/domain/lifecycle'
import type { DocType } from '@/domain/types'
import { useDocuments } from '@/hooks/useDocuments'
import { useSettings } from '@/hooks/useSettings'
import { NewDocumentDialog } from '../documents/NewDocumentDialog'
import './DashboardPage.css'

const greeting = () => {
  const h = new Date().getHours()
  return h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend'
}
const monthName = new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(new Date())
const relDays = (iso: string, today: string) => {
  const d = Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000)
  if (d === 0) return 'heute'
  if (d === 1) return 'morgen'
  if (d === -1) return 'gestern'
  return d > 0 ? `in ${d} Tagen` : `seit ${-d} Tagen`
}

interface Attention { doc: DocumentSummary; icon: typeof AlarmClock; tone: 'bad' | 'warn' | 'neutral'; text: string }

export function DashboardPage() {
  const docs = useDocuments()
  const settings = useSettings()
  const [newType, setNewType] = useState<DocType | null>(null)
  const firstName = settings.data?.users[0]?.name.split(' ')[0]
  const today = todayIso()

  const stats = useMemo(() => {
    const all = docs.data ?? []
    const openInv = all.filter((d) => d.type === 'invoice' && d.status === 'open')
    const overdue = openInv.filter((d) => d.overdue)
    const openOffers = all.filter((d) => d.type === 'offer' && d.status === 'open')
    // Bezahlt-Zeitpunkt kennt der Klickdummy nicht: das Rechnungsdatum dient als Näherung.
    const paid = all.filter((d) => d.type === 'invoice' && d.status === 'paid')
    const sum = (l: DocumentSummary[]) => l.reduce((s, d) => s + d.gross, 0)
    return {
      openSum: sum(openInv), openCount: openInv.length,
      overdueSum: sum(overdue), overdueCount: overdue.length,
      offerSum: sum(openOffers), offerCount: openOffers.length,
      paidMonth: sum(paid.filter((d) => (d.paidAt ?? d.date).slice(0, 7) === today.slice(0, 7))),
      paidYear: sum(paid.filter((d) => (d.paidAt ?? d.date).slice(0, 4) === today.slice(0, 4))),
    }
  }, [docs.data, today])

  const attention = useMemo<Attention[]>(() => {
    const all = docs.data ?? []
    const soon = addDays(today, 7)
    return [
      ...all.filter((d) => d.overdue).map((doc): Attention => ({ doc, icon: AlarmClock, tone: 'bad', text: `Fällig ${relDays(doc.dueDate!, today)}` })),
      ...all.filter((d) => d.type === 'offer' && d.status === 'open' && d.validUntil && d.validUntil <= soon)
        .map((doc): Attention => ({ doc, icon: Hourglass, tone: 'warn', text: doc.validUntil! < today ? 'Angebot abgelaufen' : `Gültig bis ${formatDate(doc.validUntil)}, ${relDays(doc.validUntil!, today)}` })),
      ...all.filter((d) => d.status === 'draft').map((doc): Attention => ({ doc, icon: FilePen, tone: 'neutral', text: `Entwurf, zuletzt geändert ${relDays(doc.updatedAt.slice(0, 10), today)}` })),
    ]
  }, [docs.data, today])

  const recent = (docs.data ?? []).slice(0, 6)

  return (
    <div className="page db">
      <header className="db-hero">
        <div className="page-head__text">
          <h1 className="db-title">{greeting()}{firstName ? `, ${firstName}` : ''}</h1>
          <p className="muted">{new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</p>
        </div>
        <span className="spacer" />
        <div className="row row--wrap">
          <Button icon={<FilePlus2 />} onClick={() => setNewType('offer')}>Neues Angebot</Button>
          <Button variant="primary" icon={<FileText />} onClick={() => setNewType('invoice')}>Neue Rechnung</Button>
        </div>
      </header>

      {docs.isError ? (
        <div className="card"><ErrorState error={docs.error} onRetry={() => docs.refetch()} /></div>
      ) : (
        <>
          <section className="db-figures" aria-label="Kennzahlen">
            <Figure loading={docs.isPending} label="Offene Rechnungen" value={formatMoney(stats.openSum)}
              note={stats.openCount === 1 ? '1 Rechnung wartet auf Zahlung' : `${stats.openCount} Rechnungen warten auf Zahlung`}
              to="/documents?type=invoice&status=open" />
            <Figure loading={docs.isPending} label="Davon überfällig" value={formatMoney(stats.overdueSum)} tone={stats.overdueCount ? 'bad' : undefined}
              note={stats.overdueCount ? `${stats.overdueCount} ${stats.overdueCount === 1 ? 'Rechnung' : 'Rechnungen'} über der Frist` : 'Alles im Zeitplan'}
              to={stats.overdueCount ? '/documents?type=invoice&status=overdue' : undefined} />
            <Figure loading={docs.isPending} label="Offene Angebote" value={formatMoney(stats.offerSum)}
              note={stats.offerCount === 1 ? '1 Angebot wartet auf Antwort' : `${stats.offerCount} Angebote warten auf Antwort`}
              to="/documents?type=offer&status=open" />
            <Figure loading={docs.isPending} label={`Bezahlt im ${monthName}`} value={formatMoney(stats.paidMonth)}
              note={`${formatMoney(stats.paidYear)} seit Jahresbeginn`} to="/documents?type=invoice&status=paid" />
          </section>

          <div className="db-columns">
            <section className="card db-panel" aria-labelledby="db-attention">
              <div className="card__head">
                <h2 className="card__title" id="db-attention">Braucht deine Aufmerksamkeit</h2>
                {!docs.isPending && attention.length > 0 && <span className="badge badge--plain">{attention.length}</span>}
              </div>
              {docs.isPending ? <RowsSkeleton /> : attention.length === 0 ? (
                <EmptyState icon={<CircleCheck />} title="Nichts zu tun">Keine überfälligen Rechnungen, keine ablaufenden Angebote, keine offenen Entwürfe.</EmptyState>
              ) : (
                <div className="list enter">
                  {attention.map(({ doc, icon: Icon, tone, text }) => (
                    <Link key={doc.id} to={`/documents/${doc.id}`} className="list__row db-att">
                      <span className={`db-att__icon db-att__icon--${tone}`}><Icon /></span>
                      <span className="db-att__text">
                        <span className="list__primary">{doc.number ?? DOC_TYPE_LABELS[doc.type]} · {doc.customerName}</span>
                        <span className="list__secondary">{text}</span>
                      </span>
                      <span className="num db-amount">{formatMoney(doc.gross)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="card db-panel" aria-labelledby="db-recent">
              <div className="card__head">
                <h2 className="card__title" id="db-recent">Zuletzt bearbeitet</h2>
                <span className="spacer" />
                <Link to="/documents" className="db-more">Alle Dokumente <ArrowUpRight /></Link>
              </div>
              {docs.isPending ? <RowsSkeleton /> : recent.length === 0 ? (
                <EmptyState icon={<FileText />} title="Noch keine Dokumente" actions={<Button variant="primary" onClick={() => setNewType('offer')}>Erstes Angebot anlegen</Button>}>
                  Hier erscheinen die Dokumente, an denen du zuletzt gearbeitet hast.
                </EmptyState>
              ) : (
                <div className="list enter">
                  {recent.map((d) => (
                    <Link key={d.id} to={`/documents/${d.id}`} className="list__row db-recent">
                      <span className="db-att__text">
                        <span className="list__primary">{d.customerName}</span>
                        <span className="list__secondary">{DOC_TYPE_LABELS[d.type]} {d.number ?? '(Entwurf)'}{d.projectName ? ` · ${d.projectName}` : ''}</span>
                      </span>
                      <StatusBadge status={d.status} overdue={d.overdue} />
                      <span className="num db-amount">{formatMoney(d.gross)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}

      <NewDocumentDialog open={newType !== null} onClose={() => setNewType(null)} type={newType ?? undefined} />
    </div>
  )
}

function Figure({ label, value, note, to, tone, loading }: { label: string; value: string; note: string; to?: string; tone?: 'bad'; loading: boolean }) {
  const body = (
    <>
      <span className="db-fig__label">{label}</span>
      {loading ? <Skeleton w="70%" h={30} r={8} /> : <span className={tone ? `db-fig__value num db-fig__value--${tone}` : 'db-fig__value num'}>{value}</span>}
      {loading ? <Skeleton w="85%" h={12} /> : <span className="db-fig__note">{note}</span>}
    </>
  )
  return to && !loading ? <Link to={to} className="db-fig db-fig--link">{body}</Link> : <div className="db-fig">{body}</div>
}

function RowsSkeleton() {
  return (
    <div className="stack" aria-busy="true" aria-label="Wird geladen" style={{ padding: 'var(--sp-2) var(--sp-5)' }}>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="row">
          <Skeleton w={32} h={32} r={999} />
          <div className="stack--sm" style={{ display: 'grid', flex: 1 }}><Skeleton w="60%" h={12} /><Skeleton w="35%" h={10} /></div>
          <Skeleton w={80} h={12} />
        </div>
      ))}
    </div>
  )
}
