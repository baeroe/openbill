import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { FileCheck2, FilePlus2, FileText, FileX2, Search } from 'lucide-react'
import { Button, cx, Dialog } from '@/components/ui'
import { DOC_TYPE_LABELS } from '@/domain/lifecycle'
import type { DocType } from '@/domain/types'
import { useCustomers } from '@/hooks/useCustomers'
import { useCreateDocument } from '@/hooks/useDocuments'
import { toast } from '@/store/toast'
import './NewDocumentDialog.css'

const TYPES: { type: DocType; icon: typeof FileText; text: string; disabled?: string }[] = [
  { type: 'offer', icon: FilePlus2, text: 'Leistungen und Preise vorschlagen. Lässt sich später umwandeln.' },
  { type: 'confirmation', icon: FileCheck2, text: 'Einen Auftrag schriftlich bestätigen.' },
  { type: 'invoice', icon: FileText, text: 'Erbrachte Leistungen berechnen, auf Wunsch als E-Rechnung.' },
  { type: 'cancellation', icon: FileX2, text: 'Entsteht immer aus einer Rechnung.', disabled: 'Öffne die Rechnung und wähle dort „Stornieren“.' },
]

export function NewDocumentDialog({ open, onClose, customerId, type: initialType }: { open: boolean; onClose(): void; customerId?: string; type?: DocType }) {
  const [type, setType] = useState<DocType>(initialType ?? 'offer')
  const [customer, setCustomer] = useState<string>(customerId ?? '')
  const [query, setQuery] = useState('')
  const customers = useCustomers()
  const create = useCreateDocument()
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    setType(initialType ?? 'offer')
    setCustomer(customerId ?? '')
    setQuery('')
  }, [open, initialType, customerId])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (customers.data ?? []).filter((c) => !q || `${c.name} ${c.number} ${c.address.city}`.toLowerCase().includes(q))
  }, [customers.data, query])

  const submit = () => {
    create.mutate({ type, customerId: customer || null }, {
      onSuccess: (doc) => {
        toast.success(`${DOC_TYPE_LABELS[type]} angelegt`)
        onClose()
        navigate(`/documents/${doc.id}`)
      },
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <Dialog open={open} onClose={onClose} wide title="Neues Dokument" description="Wähle die Art und den Kunden. Alles andere kannst du im Editor ergänzen."
      footer={<>
        <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
        <Button variant="primary" pending={create.isPending} onClick={submit}>{DOC_TYPE_LABELS[type]} anlegen</Button>
      </>}>
      <div className="nd-types" role="radiogroup" aria-label="Art des Dokuments"
        onKeyDown={(e) => {
          if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return
          e.preventDefault()
          const enabled = TYPES.filter((t) => !t.disabled)
          const i = enabled.findIndex((t) => t.type === type)
          const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : enabled.length - 1
          const next = enabled[(i + dir) % enabled.length]
          setType(next.type)
          ;(e.currentTarget.querySelector(`[data-type="${next.type}"]`) as HTMLElement | null)?.focus()
        }}>
        {TYPES.map(({ type: t, icon: Icon, text, disabled }) => (
          <button key={t} type="button" role="radio" data-type={t} aria-checked={type === t} disabled={!!disabled} title={disabled}
            tabIndex={type === t ? 0 : -1} className={cx('nd-type', type === t && 'nd-type--on')} onClick={() => setType(t)}
            data-autofocus={type === t ? '' : undefined}>
            <span className="nd-type__icon"><Icon /></span>
            <span className="nd-type__name">{DOC_TYPE_LABELS[t]}</span>
            <span className="nd-type__text">{disabled ?? text}</span>
          </button>
        ))}
      </div>

      <div className="field">
        <span className="field__label" id="nd-customer-label">Kunde</span>
        <div className="input-group">
          <Search />
          <input className="input" placeholder="Kunden suchen" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Kunden suchen" />
        </div>
        <div className="nd-customers" role="listbox" aria-labelledby="nd-customer-label">
          {customers.isError ? (
            <p className="nd-empty">Kunden konnten nicht geladen werden. <button type="button" className="nd-link" onClick={() => customers.refetch()}>Erneut versuchen</button></p>
          ) : customers.isPending ? (
            Array.from({ length: 3 }, (_, i) => <span key={i} className="skeleton" style={{ height: 40, borderRadius: 12 }} />)
          ) : (
            <>
              <button type="button" role="option" aria-selected={customer === ''} className={cx('nd-customer', customer === '' && 'nd-customer--on')} onClick={() => setCustomer('')}>
                <span className="nd-customer__name">Später wählen</span>
              </button>
              {list.map((c) => (
                <button key={c.id} type="button" role="option" aria-selected={customer === c.id} className={cx('nd-customer', customer === c.id && 'nd-customer--on')} onClick={() => setCustomer(c.id)}>
                  <span className="nd-customer__name">{c.name}</span>
                  <span className="nd-customer__meta">{c.number} · {c.address.city}</span>
                </button>
              ))}
              {list.length === 0 && <p className="nd-empty">Kein Kunde passt zu „{query}“.</p>}
            </>
          )}
        </div>
      </div>
    </Dialog>
  )
}
