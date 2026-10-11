import { useNavigate } from 'react-router'
import { todayIso } from '@/domain/dates'
import { formatDate, formatMoney } from '@/domain/format'
import { DOC_TYPE_LABELS, isOverdue } from '@/domain/lifecycle'
import type { Document } from '@/domain/types'
import { useCustomerStore } from '@/store/customerStore'
import { documentTotals } from '@/store/selectors'
import { useSettingsStore } from '@/store/settingsStore'
import { StatusBadge } from '@/ui/Badge'
import { cx } from '@/ui/cx'

/** compact blendet die Datumsspalten aus, z. B. für schmale Karten in der Übersicht. */
export function DocumentTable({ documents, showType = true, showCustomer = true, compact = false }: { documents: Document[]; showType?: boolean; showCustomer?: boolean; compact?: boolean }) {
  const customers = useCustomerStore((s) => s.customers)
  const settings = useSettingsStore()
  const navigate = useNavigate()
  const today = todayIso()

  return (
    <div className="overflow-x-auto">
      <table className={cx('w-full text-sm', compact ? 'min-w-[460px]' : 'min-w-[640px]')}>
        <thead>
          <tr className="border-b border-line text-left text-[12px] text-muted">
            <th className="py-2 pr-3 pl-5 font-medium">Nummer</th>
            {showType && <th className="px-3 py-2 font-medium">Typ</th>}
            {showCustomer && <th className="px-3 py-2 font-medium">Kunde</th>}
            {!compact && <th className="px-3 py-2 font-medium">Datum</th>}
            {!compact && <th className="px-3 py-2 font-medium">Fällig / gültig bis</th>}
            <th className="px-3 py-2 text-right font-medium">Betrag</th>
            <th className="py-2 pr-5 pl-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => {
            const customer = customers.find((c) => c.id === d.customerId)
            const gross = documentTotals(d, settings, customers).gross
            const overdue = isOverdue(d, today)
            return (
              <tr
                key={d.id}
                onClick={() => navigate(`/documents/${d.id}`)}
                className="cursor-pointer border-b border-line last:border-0 hover:bg-sheet-2"
              >
                <td className="py-2.5 pr-3 pl-5">
                  <a href={`/documents/${d.id}`} onClick={(e) => e.preventDefault()} className={cx('font-medium whitespace-nowrap', !d.number && 'text-copy-yellow-ink italic')}>
                    {d.number ?? 'Entwurf'}
                  </a>
                  {typeof d.custom.project_name === 'string' && d.custom.project_name && <span className="block text-xs text-muted">{d.custom.project_name}</span>}
                </td>
                {showType && <td className="px-3 py-2.5 text-muted">{DOC_TYPE_LABELS[d.type]}</td>}
                {showCustomer && <td className="px-3 py-2.5">{customer?.name ?? <span className="text-faint">Kein Kunde</span>}</td>}
                {!compact && <td className="px-3 py-2.5 text-muted">{formatDate(d.date)}</td>}
                {!compact && <td className={cx('px-3 py-2.5', overdue ? 'font-medium text-danger' : 'text-muted')}>{formatDate(d.dueDate ?? d.validUntil)}</td>}
                <td className="px-3 py-2.5 text-right font-medium">{formatMoney(gross)}</td>
                <td className="py-2.5 pr-5 pl-3"><StatusBadge status={d.status} overdue={overdue} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
