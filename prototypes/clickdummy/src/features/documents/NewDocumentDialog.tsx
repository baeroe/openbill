import { useState } from 'react'
import { useNavigate } from 'react-router'
import { DOC_TYPE_LABELS } from '@/domain/lifecycle'
import type { DocType } from '@/domain/types'
import { useCustomerStore } from '@/store/customerStore'
import { useDocumentStore } from '@/store/documentStore'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { Select } from '@/ui/form'

const CREATABLE: DocType[] = ['offer', 'confirmation', 'invoice']

export function NewDocumentDialog({ open, onClose, defaultType = 'offer', defaultCustomerId }: { open: boolean; onClose(): void; defaultType?: DocType; defaultCustomerId?: string }) {
  const customers = useCustomerStore((s) => s.customers)
  const createDocument = useDocumentStore((s) => s.createDocument)
  const navigate = useNavigate()
  const [type, setType] = useState<DocType>(CREATABLE.includes(defaultType) ? defaultType : 'offer')
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? customers[0]?.id ?? '')

  const create = () => {
    const id = createDocument(type, customerId || null)
    onClose()
    navigate(`/documents/${id}`)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Neues Dokument"
      footer={<><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" onClick={create}>Anlegen</Button></>}
    >
      <div className="grid gap-4">
        <Select label="Dokumenttyp" value={type} onChange={(e) => setType(e.target.value as DocType)}>
          {CREATABLE.map((t) => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
        </Select>
        <Select label="Kunde" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Später wählen</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <p className="text-xs text-muted">Stornos entstehen aus einer abgeschlossenen Rechnung über „Stornieren“.</p>
      </div>
    </Dialog>
  )
}
