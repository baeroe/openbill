import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Plus, Search, Users } from 'lucide-react'
import { ButtonLink, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui'
import { formatMoney } from '@/domain/format'
import { useCustomers } from '@/hooks/useCustomers'
import { useDocuments } from '@/hooks/useDocuments'
import { countryName, defaultContact, initials, taxTag } from './labels'
import './customers.css'

export function CustomerListPage() {
  const [query, setQuery] = useState('')
  const customers = useCustomers({ query })
  const invoices = useDocuments({ type: 'invoice' })

  // Offene Summe je Kunde aus offenen Rechnungen
  const openByCustomer = useMemo(() => {
    const map = new Map<string, { sum: number; count: number; overdue: number }>()
    for (const d of invoices.data ?? []) {
      if (d.status !== 'open' || !d.customerId) continue
      const e = map.get(d.customerId) ?? { sum: 0, count: 0, overdue: 0 }
      e.sum += d.gross
      e.count += 1
      if (d.overdue) e.overdue += 1
      map.set(d.customerId, e)
    }
    return map
  }, [invoices.data])

  return (
    <div className="page">
      <PageHeader
        title="Kunden"
        description="Stammdaten, Ansprechpartner und alle Dokumente pro Kunde."
        actions={<ButtonLink to="/customers/new" variant="primary" icon={<Plus />}>Kunde anlegen</ButtonLink>}
      />

      <div className="row row--wrap">
        <div className="input-group cust-search">
          <Search />
          <input className="input" type="search" placeholder="Name, Nummer, Ort oder Ansprechpartner" aria-label="Kunden durchsuchen" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {customers.data && <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>{customers.data.length === 1 ? '1 Kunde' : `${customers.data.length} Kunden`}</span>}
      </div>

      <div className="card card--flush">
        {customers.isError ? (
          <ErrorState error={customers.error} onRetry={() => customers.refetch()} />
        ) : !customers.data ? (
          <ListLoading />
        ) : customers.data.length === 0 ? (
          query ? (
            <EmptyState icon={<Search />} title="Kein Kunde gefunden">Zu „{query}“ passt kein Name, keine Nummer und kein Ansprechpartner.</EmptyState>
          ) : (
            <EmptyState icon={<Users />} title="Noch keine Kunden" actions={<ButtonLink to="/customers/new" variant="primary" icon={<Plus />}>Kunde anlegen</ButtonLink>}>
              Lege deinen ersten Kunden an. Danach kannst du direkt ein Angebot oder eine Rechnung für ihn schreiben.
            </EmptyState>
          )
        ) : (
          <>
            <div className="list__head cust-head-cols" aria-hidden>
              <span /><span>Kunde</span><span>Ort</span><span>Ansprechpartner</span><span>Offen</span>
            </div>
            <div className="cust-list enter">
              {customers.data.map((c) => {
                const contact = defaultContact(c)
                const tag = taxTag(c.taxTreatment)
                const open = openByCustomer.get(c.id)
                return (
                  <Link key={c.id} to={`/customers/${c.id}`} className="cust-row">
                    <span className="cust-avatar" aria-hidden>{initials(c.name)}</span>
                    <span className="cust-row__name">
                      <span className="cust-row__title"><strong>{c.name}</strong>{tag && <span className="tag tag--neutral">{tag}</span>}</span>
                      <span className="list__secondary">{c.number}</span>
                    </span>
                    <span className="cust-row__cell">
                      <span>{c.address.city || 'Ohne Ort'}</span>
                      <span className="list__secondary">{countryName(c.address.country)}</span>
                    </span>
                    <span className="cust-row__cell">
                      <span>{contact ? `${contact.firstName} ${contact.lastName}` : 'Kein Ansprechpartner'}</span>
                      <span className="list__secondary">{contact?.position || contact?.email || ' '}</span>
                    </span>
                    <span className="cust-row__sum">
                      {open ? (
                        <>
                          <strong>{formatMoney(open.sum)}</strong>
                          {open.overdue ? <span className="badge badge--bad">{open.overdue} überfällig</span> : <span className="list__secondary">{open.count === 1 ? '1 Rechnung' : `${open.count} Rechnungen`}</span>}
                        </>
                      ) : (
                        <span className="list__secondary">Nichts offen</span>
                      )}
                    </span>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ListLoading() {
  return (
    <div className="cust-list" aria-busy="true" aria-label="Kunden werden geladen">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="cust-row">
          <Skeleton w={40} h={40} r={999} />
          <span className="cust-row__name"><Skeleton w={`${50 + ((i * 13) % 30)}%`} h={14} /><Skeleton w={56} h={11} /></span>
          <span className="cust-row__cell"><Skeleton w="60%" h={12} /><Skeleton w="40%" h={11} /></span>
          <span className="cust-row__cell"><Skeleton w="70%" h={12} /><Skeleton w="45%" h={11} /></span>
          <span className="cust-row__sum"><Skeleton w={80} h={14} /></span>
        </div>
      ))}
    </div>
  )
}
