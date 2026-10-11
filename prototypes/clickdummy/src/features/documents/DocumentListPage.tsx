import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Plus, Search } from 'lucide-react'
import { DOC_TYPE_PLURAL, STATUS_LABELS } from '@/domain/lifecycle'
import type { DocStatus, DocType } from '@/domain/types'
import { useCustomerStore } from '@/store/customerStore'
import { useDocumentStore } from '@/store/documentStore'
import { Button } from '@/ui/Button'
import { EmptyState } from '@/ui/EmptyState'
import { controlClass, Select } from '@/ui/form'
import { PageHeader } from '@/ui/PageHeader'
import { Tabs } from '@/ui/Tabs'
import { cx } from '@/ui/cx'
import { DocumentTable } from './DocumentTable'
import { NewDocumentDialog } from './NewDocumentDialog'

const TYPES: DocType[] = ['offer', 'confirmation', 'invoice', 'cancellation']
type TabId = 'all' | DocType

export function DocumentListPage() {
  const documents = useDocumentStore((s) => s.documents)
  const customers = useCustomerStore((s) => s.customers)
  const [params, setParams] = useSearchParams()
  const tab = (params.get('type') as TabId) || 'all'
  const [status, setStatus] = useState<DocStatus | ''>('')
  const [customerId, setCustomerId] = useState('')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return documents
      .filter((d) => tab === 'all' || d.type === tab)
      .filter((d) => !status || d.status === status)
      .filter((d) => !customerId || d.customerId === customerId)
      .filter((d) => {
        if (!q) return true
        const customer = customers.find((c) => c.id === d.customerId)?.name ?? ''
        return [d.number ?? 'entwurf', customer, String(d.custom.project_name ?? '')].some((s) => s.toLowerCase().includes(q))
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [documents, customers, tab, status, customerId, query])

  const tabs = [
    { id: 'all' as TabId, label: 'Alle', count: documents.length },
    ...TYPES.map((t) => ({ id: t as TabId, label: DOC_TYPE_PLURAL[t], count: documents.filter((d) => d.type === t).length })),
  ]

  return (
    <>
      <PageHeader
        title="Dokumente"
        meta="Angebote, Auftragsbestätigungen, Rechnungen und Stornos"
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>Neues Dokument</Button>}
      />
      <div className="rounded-[3px] border border-line bg-sheet shadow-sheet">
        <Tabs tabs={tabs} value={tab} onChange={(id) => setParams(id === 'all' ? {} : { type: id })} className="px-3" />
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          <div className="relative min-w-52 flex-1">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint" />
            <input aria-label="Suche" placeholder="Nummer, Kunde oder Projekt" value={query} onChange={(e) => setQuery(e.target.value)} className={cx(controlClass(), 'h-8 pl-8')} />
          </div>
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as DocStatus | '')} className="h-8 w-40">
            <option value="">Alle Status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select aria-label="Kunde filtern" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="h-8 w-52">
            <option value="">Alle Kunden</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        {filtered.length ? (
          <DocumentTable documents={filtered} showType={tab === 'all'} />
        ) : (
          <div className="p-5">
            <EmptyState
              title="Keine Dokumente gefunden"
              text={documents.length ? 'Passe Filter oder Suche an.' : 'Leg dein erstes Angebot oder deine erste Rechnung an.'}
              action={!documents.length && <Button variant="primary" onClick={() => setCreating(true)}>Neues Dokument</Button>}
            />
          </div>
        )}
      </div>
      <NewDocumentDialog key={String(creating)} open={creating} onClose={() => setCreating(false)} defaultType={tab === 'all' || tab === 'cancellation' ? 'offer' : tab} />
    </>
  )
}
