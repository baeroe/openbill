import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import type { Customer, CustomerTaxTreatment } from '@/domain/types'
import { useCustomerStore } from '@/store/customerStore'
import { useDocumentStore } from '@/store/documentStore'
import { useSettingsStore } from '@/store/settingsStore'
import { Button } from '@/ui/Button'
import { CustomFieldInput, fieldDomId } from '@/ui/CustomFieldInput'
import { ConfirmDialog } from '@/ui/Dialog'
import { EmptyState } from '@/ui/EmptyState'
import { Checkbox, Input } from '@/ui/form'
import { PageHeader } from '@/ui/PageHeader'
import { Sheet } from '@/ui/Sheet'
import { useHashFocus } from '@/ui/useHashFocus'
import { DocumentTable } from '../documents/DocumentTable'
import { NewDocumentDialog } from '../documents/NewDocumentDialog'
import { ContactsEditor } from './ContactsEditor'

const TREATMENTS: { id: CustomerTaxTreatment; label: string; hint: string }[] = [
  { id: 'domestic', label: 'Inland', hint: 'Normale Umsatzsteuer nach den Sätzen der Positionen.' },
  { id: 'eu_reverse_charge', label: 'EU-Unternehmen mit USt-ID', hint: 'Reverse Charge: keine deutsche Umsatzsteuer, Hinweis wird automatisch gesetzt. USt-ID ist Pflicht.' },
  { id: 'third_country', label: 'Drittland', hint: 'Leistung außerhalb der EU: nicht im Inland steuerbar.' },
]

export function CustomerDetailPage() {
  const { id = '' } = useParams()
  const { customers, upsertCustomer, removeCustomer } = useCustomerStore()
  const fields = useSettingsStore((s) => s.fieldDefs.customer)
  const documents = useDocumentStore((s) => s.documents).filter((d) => d.customerId === id)
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const [creating, setCreating] = useState(false)
  useHashFocus()
  const customer = customers.find((c) => c.id === id)
  if (!customer) return <EmptyState title="Kunde nicht gefunden" action={<Link to="/customers" className="text-carbon">Zur Kundenliste</Link>} />

  const set = (patch: Partial<Customer>) => upsertCustomer({ ...customer, ...patch })
  const setAddress = (patch: Partial<Customer['address']>) => set({ address: { ...customer.address, ...patch } })

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/customers" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"><ArrowLeft size={14} /> Kunden</Link>
      <PageHeader
        title={customer.name || 'Ohne Namen'}
        meta={customer.number}
        actions={
          <>
            <Button variant="ghost" icon={<Trash2 size={14} />} disabled={documents.length > 0} title={documents.length ? 'Kunden mit Dokumenten lassen sich nicht löschen' : undefined} onClick={() => setConfirm(true)}>Kunde löschen</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>Neues Dokument</Button>
          </>
        }
      />
      <div className="grid gap-5">
        <Sheet title="Stammdaten" description="Änderungen werden sofort gespeichert.">
          <div className="grid gap-4 sm:grid-cols-6">
            <Input label="Name" value={customer.name} onChange={(e) => set({ name: e.target.value })} wrapClassName="sm:col-span-4" />
            <Input label="Kundennummer" value={customer.number} onChange={(e) => set({ number: e.target.value })} wrapClassName="sm:col-span-2" />
            <Input id={fieldDomId('customer.address')} label="Straße und Hausnummer" value={customer.address.street} onChange={(e) => setAddress({ street: e.target.value })} wrapClassName="sm:col-span-6" />
            <Input label="PLZ" value={customer.address.zip} onChange={(e) => setAddress({ zip: e.target.value })} wrapClassName="sm:col-span-2" />
            <Input label="Ort" value={customer.address.city} onChange={(e) => setAddress({ city: e.target.value })} wrapClassName="sm:col-span-3" />
            <Input label="Land" hint="ISO-Code, z. B. DE" maxLength={2} value={customer.address.country} onChange={(e) => setAddress({ country: e.target.value.toUpperCase() })} wrapClassName="sm:col-span-1" />
            <Input label="E-Mail für Rechnungen" type="email" value={customer.email} onChange={(e) => set({ email: e.target.value })} wrapClassName="sm:col-span-3" />
            <Input id={fieldDomId('customer.vat_id')} label="USt-ID" value={customer.vatId} onChange={(e) => set({ vatId: e.target.value })} wrapClassName="sm:col-span-3" />
          </div>
          {fields.length > 0 && (
            <div className="mt-5 grid gap-4 border-t border-dashed border-line pt-5 sm:grid-cols-2">
              {fields.map((def) => (
                <CustomFieldInput key={def.id} id={fieldDomId(`customer.${def.key}`)} def={def} value={customer.custom[def.key]} onChange={(v) => set({ custom: { ...customer.custom, [def.key]: v } })} />
              ))}
            </div>
          )}
        </Sheet>

        <Sheet title="Steuerbehandlung" description="Bestimmt Steuerkategorie und Pflichthinweis auf allen Dokumenten für diesen Kunden.">
          <div role="radiogroup" className="grid gap-3">
            {TREATMENTS.map((t) => (
              <Checkbox key={t.id} type="radio" name="tax" label={t.label} hint={t.hint} checked={customer.taxTreatment === t.id} onChange={() => set({ taxTreatment: t.id })} />
            ))}
          </div>
        </Sheet>

        <ContactsEditor customer={customer} />

        <Sheet title="Dokumente" bodyClassName="p-0">
          {documents.length ? <DocumentTable documents={documents} showCustomer={false} /> : <p className="p-5 text-sm text-muted">Noch keine Dokumente für diesen Kunden.</p>}
        </Sheet>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={() => { removeCustomer(customer.id); navigate('/customers') }} title="Kunde löschen?" text="Der Kunde und seine Ansprechpartner werden entfernt." confirmLabel="Löschen" danger />
      <NewDocumentDialog key={String(creating)} open={creating} onClose={() => setCreating(false)} defaultCustomerId={customer.id} />
    </div>
  )
}
