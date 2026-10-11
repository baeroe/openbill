import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus, Search } from 'lucide-react'
import { formatMoney } from '@/domain/format'
import type { Customer } from '@/domain/types'
import { useCustomerStore } from '@/store/customerStore'
import { useDocumentStore } from '@/store/documentStore'
import { newId } from '@/store/ids'
import { documentTotals } from '@/store/selectors'
import { useSettingsStore } from '@/store/settingsStore'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { cx } from '@/ui/cx'
import { controlClass } from '@/ui/form'
import { PageHeader } from '@/ui/PageHeader'
import { TAX_TREATMENT_LABELS } from '../documents/labels'

export function nextCustomerNumber(customers: Customer[]) {
  const max = Math.max(1000, ...customers.map((c) => parseInt(c.number.replace(/\D/g, ''), 10) || 0))
  return `K-${max + 1}`
}

export function CustomerListPage() {
  const { customers, upsertCustomer } = useCustomerStore()
  const documents = useDocumentStore((s) => s.documents)
  const settings = useSettingsStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const rows = useMemo(() => customers
    .filter((c) => !query || `${c.name} ${c.number} ${c.address.city}`.toLowerCase().includes(query.toLowerCase()))
    .map((c) => {
      const open = documents.filter((d) => d.customerId === c.id && d.type === 'invoice' && d.status === 'open')
      return { c, open: open.reduce((s, d) => s + documentTotals(d, settings, customers).gross, 0), count: documents.filter((d) => d.customerId === c.id).length }
    }), [customers, documents, settings, query])

  const create = () => {
    const c: Customer = {
      id: newId(), number: nextCustomerNumber(customers), name: 'Neuer Kunde', address: { street: '', zip: '', city: '', country: 'DE' },
      email: '', vatId: '', taxTreatment: 'domestic', contacts: [], custom: {},
    }
    upsertCustomer(c)
    navigate(`/customers/${c.id}`)
  }

  return (
    <>
      <PageHeader title="Kunden" meta={`${customers.length} Kunden`} actions={<Button variant="primary" icon={<Plus size={16} />} onClick={create}>Neuer Kunde</Button>} />
      <div className="rounded-[3px] border border-line bg-sheet shadow-sheet">
        <div className="border-b border-line px-5 py-3">
          <div className="relative max-w-sm">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint" />
            <input aria-label="Kunden suchen" placeholder="Name, Nummer oder Ort" value={query} onChange={(e) => setQuery(e.target.value)} className={cx(controlClass(), 'h-8 pl-8')} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th className="py-2 pr-3 pl-5 font-medium">Nr.</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Ort</th>
                <th className="px-3 py-2 font-medium">Steuer</th>
                <th className="px-3 py-2 font-medium">Dokumente</th>
                <th className="py-2 pr-5 pl-3 text-right font-medium">Offen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, open, count }) => (
                <tr key={c.id} onClick={() => navigate(`/customers/${c.id}`)} className="cursor-pointer border-b border-line last:border-0 hover:bg-sheet-2">
                  <td className="py-2.5 pr-3 pl-5 text-muted">{c.number}</td>
                  <td className="px-3 py-2.5 font-medium">{c.name}</td>
                  <td className="px-3 py-2.5 text-muted">{[c.address.city, c.address.country !== 'DE' && c.address.country].filter(Boolean).join(', ')}</td>
                  <td className="px-3 py-2.5"><Badge tone={c.taxTreatment === 'domestic' ? 'neutral' : 'blue'}>{TAX_TREATMENT_LABELS[c.taxTreatment]}</Badge></td>
                  <td className="px-3 py-2.5 text-muted">{count}</td>
                  <td className="py-2.5 pr-5 pl-3 text-right font-medium">{open ? formatMoney(open) : <span className="text-faint">–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
