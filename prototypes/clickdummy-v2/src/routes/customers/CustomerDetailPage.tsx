import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AlertTriangle, ChevronLeft, FilePlus, MoreHorizontal, Pencil, Plus, Settings2, Star, Trash2, UserRound } from 'lucide-react'
import { Badge, Button, Dialog, ErrorState, Menu, MenuItem, Select, Skeleton, TextInput } from '@/components/ui'
import { CustomFieldInput } from '@/components/CustomFieldInput'
import { fieldsFor } from '@/domain/fields'
import type { Contact, Customer } from '@/domain/types'
import { emptyCustomer, useCustomer, useDeleteCustomer, useSaveCustomer } from '@/hooks/useCustomers'
import { useSettings } from '@/hooks/useSettings'
import { NewDocumentDialog } from '@/routes/documents/NewDocumentDialog'
import { toast } from '@/store/toast'
import { ContactDrawer } from './ContactDrawer'
import { CustomerDocuments } from './CustomerDocuments'
import { countryName, initials, TAX_TREATMENT_OPTIONS } from './labels'
import './customers.css'

const COUNTRIES = ['DE', 'AT', 'CH', 'NL', 'BE', 'FR', 'IT', 'ES', 'DK', 'SE', 'PL', 'CZ', 'GB', 'US']

export function CustomerDetailPage() {
  const { id = 'new' } = useParams()
  // Neu laden beim Wechsel des Kunden, damit der Entwurf nicht mitwandert
  return id === 'new' ? <CustomerEditor key="new" initial={emptyCustomer()} isNew /> : <ExistingCustomer key={id} id={id} />
}

function ExistingCustomer({ id }: { id: string }) {
  const query = useCustomer(id)
  if (query.isError) return <div className="page"><BackLink /><ErrorState error={query.error} onRetry={() => query.refetch()} title="Kunde nicht geladen" /></div>
  if (!query.data) return <DetailSkeleton />
  return <CustomerEditor initial={query.data} isNew={false} />
}

function BackLink() {
  return <Link className="back" to="/customers"><ChevronLeft />Alle Kunden</Link>
}

function CustomerEditor({ initial, isNew }: { initial: Customer; isNew: boolean }) {
  const navigate = useNavigate()
  const settings = useSettings()
  const save = useSaveCustomer()
  const remove = useDeleteCustomer()
  const [base, setBase] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const [triedSave, setTriedSave] = useState(false)
  const [editing, setEditing] = useState<{ contact: Contact; isNew: boolean } | null>(null)
  const [newDoc, setNewDoc] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(base), [draft, base])
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const defs = settings.data?.fieldDefs ?? []
  const customerFields = fieldsFor(defs, 'customer')
  const contactFields = fieldsFor(defs, 'contact')
  const set = (patch: Partial<Customer>) => setDraft((d) => ({ ...d, ...patch }))
  const setAddress = (patch: Partial<Customer['address']>) => setDraft((d) => ({ ...d, address: { ...d.address, ...patch } }))
  const nameError = triedSave && !draft.name.trim() ? 'Der Kunde braucht einen Namen.' : undefined
  const vatMissing = draft.taxTreatment === 'eu_reverse_charge' && !draft.vatId.trim()

  const submit = () => {
    setTriedSave(true)
    if (!draft.name.trim()) {
      document.querySelector<HTMLInputElement>('[data-path="customer.name"] input')?.focus()
      return
    }
    save.mutate(draft, {
      onSuccess: (saved) => {
        setBase(saved)
        setDraft(saved)
        setTriedSave(false)
        toast.success(isNew ? 'Kunde angelegt' : 'Änderungen gespeichert')
        if (isNew) navigate(`/customers/${saved.id}`, { replace: true })
      },
      onError: (e) => toast.error(e.message),
    })
  }

  const applyContact = (c: Contact) => {
    setDraft((d) => {
      const exists = d.contacts.some((x) => x.id === c.id)
      let contacts = exists ? d.contacts.map((x) => (x.id === c.id ? c : x)) : [...d.contacts, c]
      if (c.isDefault) contacts = contacts.map((x) => ({ ...x, isDefault: x.id === c.id }))
      if (!contacts.some((x) => x.isDefault) && contacts.length) contacts = contacts.map((x, i) => ({ ...x, isDefault: i === 0 }))
      return { ...d, contacts }
    })
    setEditing(null)
  }
  const makeDefault = (cid: string) => set({ contacts: draft.contacts.map((x) => ({ ...x, isDefault: x.id === cid })) })
  const removeContact = (cid: string) => {
    const rest = draft.contacts.filter((x) => x.id !== cid)
    if (rest.length && !rest.some((x) => x.isDefault)) rest[0] = { ...rest[0], isDefault: true }
    set({ contacts: rest })
  }
  const newContact = (): Contact => ({
    id: `con-new-${Date.now()}`, salutation: '', firstName: '', lastName: '', position: '', email: '', phone: '',
    isDefault: draft.contacts.length === 0, custom: {},
  })

  const title = draft.name.trim() || (isNew ? 'Neuer Kunde' : 'Ohne Namen')

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-head__text">
          <BackLink />
          <div className="cust-title">
            <span className="cust-avatar cust-avatar--lg" aria-hidden>{isNew && !draft.name.trim() ? <UserRound /> : initials(draft.name)}</span>
            <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
              <h1>{title}</h1>
              <div className="cust-title__meta">
                <span className="num">{draft.number}</span>
                {draft.address.city && <span>{draft.address.city}, {countryName(draft.address.country)}</span>}
                {isNew && <Badge plain>Noch nicht gespeichert</Badge>}
              </div>
            </div>
          </div>
        </div>
        <span className="spacer" />
        <div className="row row--wrap">
          {!isNew && <Button variant="soft" icon={<FilePlus />} onClick={() => setNewDoc(true)} disabled={dirty} title={dirty ? 'Speichere zuerst die Änderungen.' : undefined}>Neues Dokument</Button>}
          <Button variant="primary" pending={save.isPending} onClick={submit} disabled={!dirty && !isNew}>{isNew ? 'Kunde anlegen' : 'Speichern'}</Button>
          {!isNew && (
            <Menu trigger={({ toggle, ref, open }) => <Button ref={ref} iconOnly icon={<MoreHorizontal />} onClick={toggle} aria-haspopup="menu" aria-expanded={open}>Weitere Aktionen</Button>}>
              {(close) => <MenuItem danger icon={<Trash2 />} onClick={() => { close(); setConfirmDelete(true) }}>Kunde löschen</MenuItem>}
            </Menu>
          )}
        </div>
      </header>

      <div className="cust-detail">
        <div className="stack stack--lg">
          <section className="card" aria-labelledby="cust-base">
            <div className="card__head"><h2 className="card__title" id="cust-base">Stammdaten</h2></div>
            <div className="grid-2">
              <TextInput label="Name" path="customer.name" value={draft.name} onChange={(e) => set({ name: e.target.value })} error={nameError} placeholder="Firma oder Person" wrapClassName="span-2" autoFocus={isNew} />
              <TextInput label="Kundennummer" value={draft.number} onChange={(e) => set({ number: e.target.value })} className="num" />
              <TextInput label="E-Mail für Rechnungen" type="email" value={draft.email} onChange={(e) => set({ email: e.target.value })} />
              <TextInput label="Straße und Hausnummer" path="customer.address" value={draft.address.street} onChange={(e) => setAddress({ street: e.target.value })} wrapClassName="span-2" />
              <TextInput label="PLZ" value={draft.address.zip} onChange={(e) => setAddress({ zip: e.target.value })} />
              <TextInput label="Ort" value={draft.address.city} onChange={(e) => setAddress({ city: e.target.value })} />
              <Select label="Land" value={draft.address.country} onChange={(e) => setAddress({ country: e.target.value })}>
                {[...new Set([draft.address.country, ...COUNTRIES])].filter(Boolean).map((c) => <option key={c} value={c}>{countryName(c)}</option>)}
              </Select>
              <TextInput label="USt-ID" path="customer.vat_id" value={draft.vatId} onChange={(e) => set({ vatId: e.target.value })} placeholder="z. B. DE123456789"
                error={vatMissing && triedSave ? 'Bei Reverse Charge ist die USt-ID Pflicht.' : undefined} />
            </div>
          </section>

          <section className="card" aria-labelledby="cust-tax">
            <div className="card__head">
              <div>
                <h2 className="card__title" id="cust-tax">Steuerbehandlung</h2>
                <p className="card__desc">Bestimmt, wie Umsatzsteuer auf den Dokumenten dieses Kunden berechnet wird.</p>
              </div>
            </div>
            <div className="tax-options" role="radiogroup" aria-labelledby="cust-tax">
              {TAX_TREATMENT_OPTIONS.map((o) => (
                <label key={o.value} className="tax-option">
                  <input type="radio" name="tax-treatment" value={o.value} checked={draft.taxTreatment === o.value} onChange={() => set({ taxTreatment: o.value })} />
                  <strong>{o.label}</strong>
                  <span>{o.description}</span>
                </label>
              ))}
            </div>
            {vatMissing && (
              <div className="notice notice--warn" style={{ marginTop: 'var(--sp-4)' }}>
                <AlertTriangle />
                <span><b>USt-ID fehlt.</b> Ohne sie lässt sich eine Rechnung mit Reverse Charge nicht abschließen.</span>
              </div>
            )}
          </section>

          <section className="card" aria-labelledby="cust-fields">
            <div className="card__head">
              <div>
                <h2 className="card__title" id="cust-fields">Eigene Felder</h2>
                <p className="card__desc">Im Template als <span className="key">{'{{ customer.schlüssel }}'}</span> verfügbar.</p>
              </div>
              <span className="spacer" />
              <Link className="btn btn--ghost btn--sm" to="/fields?scope=customer"><Settings2 />Felder verwalten</Link>
            </div>
            {settings.isError ? (
              <ErrorState error={settings.error} onRetry={() => settings.refetch()} />
            ) : !settings.data ? (
              <div className="grid-2"><Skeleton h={60} /><Skeleton h={60} /></div>
            ) : customerFields.length === 0 ? (
              <p className="muted">Für Kunden gibt es noch keine eigenen Felder. Lege welche unter „Eigene Felder“ an, zum Beispiel eine Branche oder deine Lieferantennummer.</p>
            ) : (
              <div className="grid-2">
                {customerFields.map((def) => (
                  <CustomFieldInput key={def.id} def={def} path={`customer.${def.key}`} value={draft.custom[def.key]} onChange={(v) => set({ custom: { ...draft.custom, [def.key]: v } })} />
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="stack stack--lg">
          <section className="card" aria-labelledby="cust-contacts">
            <div className="card__head">
              <div>
                <h2 className="card__title" id="cust-contacts">Ansprechpartner</h2>
                <p className="card__desc">Der Standard wird in neue Dokumente übernommen.</p>
              </div>
              <span className="spacer" />
              <Button size="sm" variant="soft" icon={<Plus />} onClick={() => setEditing({ contact: newContact(), isNew: true })}>Hinzufügen</Button>
            </div>
            {draft.contacts.length === 0 ? (
              <p className="muted">Noch kein Ansprechpartner. Dokumente gehen dann allgemein an die Firma.</p>
            ) : (
              <div className="stack stack--sm" style={{ gap: 2, margin: '0 calc(var(--sp-3) * -1)' }}>
                {draft.contacts.map((c) => {
                  const name = [c.salutation, c.firstName, c.lastName].filter(Boolean).join(' ') || 'Ohne Namen'
                  return (
                    <div key={c.id} className="contact">
                      <span className="avatar" aria-hidden>{initials(`${c.firstName} ${c.lastName}`)}</span>
                      <div className="contact__text">
                        <div className="contact__name"><span>{name}</span>{c.isDefault && <span className="tag">Standard</span>}</div>
                        <div className="contact__sub">{[c.position, c.email].filter(Boolean).join(' · ') || 'Keine Kontaktdaten'}</div>
                      </div>
                      <Menu trigger={({ toggle, ref, open }) => <Button ref={ref} size="sm" variant="ghost" iconOnly icon={<MoreHorizontal />} onClick={toggle} aria-haspopup="menu" aria-expanded={open}>{`Aktionen für ${name}`}</Button>}>
                        {(close) => (
                          <>
                            <MenuItem icon={<Pencil />} onClick={() => { close(); setEditing({ contact: c, isNew: false }) }}>Bearbeiten</MenuItem>
                            <MenuItem icon={<Star />} disabled={c.isDefault} onClick={() => { close(); makeDefault(c.id) }}>Als Standard setzen</MenuItem>
                            <div className="menu__sep" />
                            <MenuItem danger icon={<Trash2 />} onClick={() => { close(); removeContact(c.id) }}>Entfernen</MenuItem>
                          </>
                        )}
                      </Menu>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {!isNew && <CustomerDocuments customerId={draft.id} onNew={() => setNewDoc(true)} />}
        </div>
      </div>

      {dirty && (
        <div className="savebar" role="region" aria-label="Ungespeicherte Änderungen">
          <span className="savebar__text">{isNew ? 'Neuer Kunde, noch nicht gespeichert' : 'Ungespeicherte Änderungen'}</span>
          <Button size="sm" variant="ghost" onClick={() => (isNew ? navigate('/customers') : (setDraft(base), setTriedSave(false)))}>{isNew ? 'Verwerfen' : 'Zurücksetzen'}</Button>
          <Button size="sm" variant="primary" pending={save.isPending} onClick={submit}>{isNew ? 'Kunde anlegen' : 'Speichern'}</Button>
        </div>
      )}

      <ContactDrawer contact={editing?.contact ?? null} isNew={!!editing?.isNew} fieldDefs={contactFields} onClose={() => setEditing(null)} onApply={applyContact} />
      {!isNew && <NewDocumentDialog open={newDoc} onClose={() => setNewDoc(false)} customerId={draft.id} />}
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title={`${base.name} löschen?`}
        description="Der Kunde und seine Entwürfe werden entfernt. Kunden mit abgeschlossenen Dokumenten bleiben erhalten."
        footer={<>
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Abbrechen</Button>
          <Button variant="danger" icon={<Trash2 />} pending={remove.isPending} onClick={() => remove.mutate(base.id, {
            onSuccess: () => { toast.success('Kunde gelöscht'); navigate('/customers') },
            onError: (e) => { setConfirmDelete(false); toast.error(e.message) },
          })}>Löschen</Button>
        </>} />
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Kunde wird geladen">
      <div className="stack stack--sm">
        <Skeleton w={90} h={12} />
        <div className="row"><Skeleton w={52} h={52} r={999} /><div className="stack stack--sm" style={{ flex: 1 }}><Skeleton w="40%" h={30} /><Skeleton w={120} h={12} /></div></div>
      </div>
      <div className="cust-detail">
        <div className="stack stack--lg">
          <div className="card stack"><Skeleton w={110} h={18} /><div className="grid-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} h={58} />)}</div></div>
          <div className="card stack"><Skeleton w={150} h={18} /><Skeleton h={90} /></div>
        </div>
        <div className="stack stack--lg">
          <div className="card stack">{Array.from({ length: 3 }, (_, i) => <div key={i} className="row"><Skeleton w={32} h={32} r={999} /><Skeleton w="60%" h={14} /></div>)}</div>
          <div className="card stack">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} h={36} />)}</div>
        </div>
      </div>
    </div>
  )
}
