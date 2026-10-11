import { useEffect, useState } from 'react'
import { Button, Drawer, Select, Switch, TextInput } from '@/components/ui'
import { CustomFieldInput } from '@/components/CustomFieldInput'
import type { Contact, FieldDef } from '@/domain/types'

interface Props {
  contact: Contact | null
  isNew: boolean
  fieldDefs: FieldDef[]
  onClose(): void
  onApply(c: Contact): void
}

const SALUTATIONS = ['', 'Frau', 'Herr', 'Divers']

/** Ansprechpartner bearbeiten. Änderungen landen im Kunden-Entwurf und werden mit ihm gespeichert. */
export function ContactDrawer({ contact, isNew, fieldDefs, onClose, onApply }: Props) {
  const [draft, setDraft] = useState<Contact | null>(contact)
  const [touched, setTouched] = useState(false)
  useEffect(() => { setDraft(contact); setTouched(false) }, [contact])

  if (!draft) return null
  const set = (patch: Partial<Contact>) => setDraft({ ...draft, ...patch })
  const nameMissing = !draft.firstName.trim() && !draft.lastName.trim()

  return (
    <Drawer
      open={!!contact}
      onClose={onClose}
      title={isNew ? 'Ansprechpartner hinzufügen' : 'Ansprechpartner bearbeiten'}
      description="Die Änderung wird mit dem Kunden gespeichert."
      footer={<>
        <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
        <Button variant="primary" onClick={() => {
          setTouched(true)
          if (nameMissing) return
          onApply(draft)
        }}>{isNew ? 'Hinzufügen' : 'Übernehmen'}</Button>
      </>}
    >
      <div className="grid-2">
        <Select label="Anrede" value={draft.salutation} onChange={(e) => set({ salutation: e.target.value })}>
          {SALUTATIONS.map((s) => <option key={s} value={s}>{s || 'Keine'}</option>)}
        </Select>
        <TextInput label="Position" value={draft.position} placeholder="z. B. Einkauf" onChange={(e) => set({ position: e.target.value })} />
        <TextInput label="Vorname" value={draft.firstName} onChange={(e) => set({ firstName: e.target.value })} error={touched && nameMissing ? 'Gib einen Vor- oder Nachnamen ein.' : undefined} />
        <TextInput label="Nachname" value={draft.lastName} onChange={(e) => set({ lastName: e.target.value })} />
        <TextInput label="E-Mail" type="email" value={draft.email} onChange={(e) => set({ email: e.target.value })} wrapClassName="span-2" />
        <TextInput label="Telefon" type="tel" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} wrapClassName="span-2" />
      </div>
      <Switch label="Standard-Ansprechpartner für neue Dokumente" checked={draft.isDefault} onChange={(e) => set({ isDefault: e.target.checked })} />
      {fieldDefs.length > 0 && (
        <div className="stack">
          <h3 style={{ fontSize: 'var(--text-md)' }}>Eigene Felder</h3>
          {fieldDefs.map((def) => (
            <CustomFieldInput key={def.id} def={def} value={draft.custom[def.key]} onChange={(v) => set({ custom: { ...draft.custom, [def.key]: v } })} />
          ))}
        </div>
      )}
    </Drawer>
  )
}
