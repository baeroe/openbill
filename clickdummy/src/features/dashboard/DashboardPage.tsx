import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Plus } from 'lucide-react'
import { addDays, todayIso } from '@/domain/dates'
import { formatDate, formatMoney } from '@/domain/format'
import { isOverdue } from '@/domain/lifecycle'
import type { Document } from '@/domain/types'
import { useCustomerStore } from '@/store/customerStore'
import { useDocumentStore } from '@/store/documentStore'
import { documentTotals } from '@/store/selectors'
import { useSessionStore } from '@/store/sessionStore'
import { useSettingsStore } from '@/store/settingsStore'
import { Button } from '@/ui/Button'
import { cx } from '@/ui/cx'
import { PageHeader } from '@/ui/PageHeader'
import { Sheet } from '@/ui/Sheet'
import { DocumentTable } from '../documents/DocumentTable'
import { NewDocumentDialog } from '../documents/NewDocumentDialog'

function Figure({ label, amount, count, tone, testId, to }: { label: string; amount: number; count: number; tone?: 'danger'; testId: string; to: string }) {
  return (
    <Link to={to} data-testid={testId} className="group flex flex-col gap-1 px-5 py-4 hover:bg-sheet-2">
      <span className="text-[13px] text-muted group-hover:text-ink">{label}</span>
      <span className={cx('font-cond text-[26px] leading-none font-semibold tracking-[-0.01em]', tone === 'danger' && count > 0 && 'text-danger')}>
        {formatMoney(amount)}
      </span>
      <span className="text-xs text-faint">{count === 1 ? '1 Dokument' : `${count} Dokumente`}</span>
    </Link>
  )
}

export function DashboardPage() {
  const documents = useDocumentStore((s) => s.documents)
  const customers = useCustomerStore((s) => s.customers)
  const settings = useSettingsStore()
  const user = useSessionStore((s) => s.user)
  const [creating, setCreating] = useState(false)
  const today = todayIso()

  const stats = useMemo(() => {
    const sum = (docs: Document[]) => ({ amount: docs.reduce((s, d) => s + documentTotals(d, settings, customers).gross, 0), count: docs.length })
    const openInvoices = documents.filter((d) => d.type === 'invoice' && d.status === 'open')
    return {
      open: sum(openInvoices),
      overdue: sum(openInvoices.filter((d) => isOverdue(d, today))),
      offers: sum(documents.filter((d) => d.type === 'offer' && d.status === 'open')),
      paid: sum(documents.filter((d) => d.type === 'invoice' && d.status === 'paid' && d.updatedAt.slice(0, 10) >= addDays(today, -30))),
    }
  }, [documents, customers, settings, today])

  const recent = [...documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6)
  const drafts = documents.filter((d) => d.status === 'draft')

  return (
    <>
      <PageHeader
        title={`Hallo ${user?.name.split(' ')[0] ?? ''}`}
        meta={`Heute ist ${formatDate(today)}.`}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>Neues Dokument</Button>}
      />

      <div className="mb-6 grid grid-cols-1 divide-y divide-line overflow-hidden rounded-[3px] border border-line bg-sheet shadow-sheet sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x [&>*]:border-line sm:[&>*:nth-child(-n+2)]:border-b lg:[&>*:nth-child(-n+2)]:border-b-0 sm:[&>*:nth-child(odd)]:border-r lg:[&>*:nth-child(odd)]:border-r-0">
        <Figure testId="kpi-open" label="Offene Rechnungen" {...stats.open} to="/documents?type=invoice" />
        <Figure testId="kpi-overdue" label="Davon überfällig" {...stats.overdue} tone="danger" to="/documents?type=invoice" />
        <Figure testId="kpi-offers" label="Offene Angebote" {...stats.offers} to="/documents?type=offer" />
        <Figure testId="kpi-paid" label="Bezahlt in 30 Tagen" {...stats.paid} to="/documents?type=invoice" />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Sheet title="Zuletzt bearbeitet" bodyClassName="p-0">
          <DocumentTable documents={recent} compact />
        </Sheet>
        <Sheet title="Entwürfe" description={drafts.length ? 'Noch nicht abgeschlossen' : undefined}>
          {drafts.length ? (
            <ul className="-my-1 divide-y divide-line">
              {drafts.map((d) => (
                <li key={d.id}>
                  <Link to={`/documents/${d.id}`} className="flex items-baseline justify-between gap-3 py-2 text-sm hover:text-carbon">
                    <span className="truncate">{customers.find((c) => c.id === d.customerId)?.name ?? 'Ohne Kunde'}</span>
                    <span className="shrink-0 font-medium">{formatMoney(documentTotals(d, settings, customers).gross)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Alles abgeschlossen.</p>
          )}
        </Sheet>
      </div>
      <NewDocumentDialog key={String(creating)} open={creating} onClose={() => setCreating(false)} />
    </>
  )
}
