import { useState } from 'react'
import { Pencil, Plus, Star, Trash2 } from 'lucide-react'
import type { Contact, Customer } from '@/domain/types'
import { useCustomerStore } from '@/store/customerStore'
import { newId } from '@/store/ids'
import { useSettingsStore } from '@/store/settingsStore'
import { Button } from '@/ui/Button'
import { CustomFieldInput } from '@/ui/CustomFieldInput'
import { cx } from '@/ui/cx'
import { Dialog } from '@/ui/Dialog'
import { Input, Select } from '@/ui/form'
import { Sheet } from '@/ui/Sheet'

const empty = (): Contact => ({ id: newId(), salutation: '', firstName: '', lastName: '', position: '', email: '', phone: '', isDefault: false, custom: {} })

function ContactDialog({ contact, onClose, onSave }: { contact: Contact; onClose(): void; onSave(c: Contact): void }) {
  const fields = useSettingsStore((s) => s.fieldDefs.contact)
  const [c, setC] = useState(contact)
  const set = (patch: Partial<Contact>) => setC({ ...c, ...patch })
  return (
    <Dialog
      open
      onClose={onClose}
      title={contact.firstName ? `${contact.firstName} ${contact.lastName}` : 'Neuer Ansprechpartner'}
      footer={<><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!c.firstName && !c.lastName} onClick={() => { onSave(c); onClose() }}>Speichern</Button></>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Anrede" value={c.salutation} onChange={(e) => set({ salutation: e.target.value })}>
          <option value="">–</option><option>Frau</option><option>Herr</option><option>Divers</option>
        </Select>
        <Input label="Position" value={c.position} onChange={(e) => set({ position: e.target.value })} />
        <Input label="Vorname" value={c.firstName} onChange={(e) => set({ firstName: e.target.value })} autoFocus />
        <Input label="Nachname" value={c.lastName} onChange={(e) => set({ lastName: e.target.value })} />
        <Input label="E-Mail" type="email" value={c.email} onChange={(e) => set({ email: e.target.value })} />
        <Input label="Telefon" value={c.phone} onChange={(e) => set({ phone: e.target.value })} />
        {fields.map((def) => (
          <CustomFieldInput key={def.id} id={`contact-${def.key}`} def={def} value={c.custom[def.key]} onChange={(v) => set({ custom: { ...c.custom, [def.key]: v } })} />
        ))}
      </div>
    </Dialog>
  )
}

export function ContactsEditor({ customer }: { customer: Customer }) {
  const { upsertContact, removeContact, setDefaultContact } = useCustomerStore()
  const [editing, setEditing] = useState<Contact | null>(null)

  return (
    <Sheet
      title="Ansprechpartner"
      description="Der Standard-Kontakt wird in neuen Dokumenten vorausgewählt."
      actions={<Button size="sm" icon={<Plus size={14} />} onClick={() => setEditing(empty())}>Ansprechpartner hinzufügen</Button>}
    >
      {customer.contacts.length === 0 ? (
        <p className="text-sm text-muted">Noch keine Ansprechpartner.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {customer.contacts.map((c) => (
            <li key={c.id} data-testid={c.isDefault ? 'contact-default' : undefined} className={cx('flex items-start gap-3 rounded-[3px] border p-3', c.isDefault ? 'border-carbon/40 bg-carbon-soft/40' : 'border-line')}>
              <button
                type="button"
                aria-label={`${c.firstName} ${c.lastName} als Standard setzen`}
                title={c.isDefault ? 'Standard-Kontakt' : 'Als Standard setzen'}
                onClick={() => setDefaultContact(customer.id, c.id)}
                className={cx('mt-0.5', c.isDefault ? 'text-carbon' : 'text-faint hover:text-ink')}
              >
                <Star size={15} fill={c.isDefault ? 'currentColor' : 'none'} />
              </button>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{c.salutation} {c.firstName} {c.lastName}</p>
                <p className="text-muted">{c.position}</p>
                <p className="truncate text-muted">{c.email}</p>
              </div>
              <Button size="sm" variant="ghost" aria-label="Bearbeiten" onClick={() => setEditing(c)} icon={<Pencil size={13} />} />
              <Button size="sm" variant="ghost" aria-label="Entfernen" onClick={() => removeContact(customer.id, c.id)} icon={<Trash2 size={13} />} />
            </li>
          ))}
        </ul>
      )}
      {editing && <ContactDialog contact={editing} onClose={() => setEditing(null)} onSave={(c) => upsertContact(customer.id, c)} />}
    </Sheet>
  )
}
