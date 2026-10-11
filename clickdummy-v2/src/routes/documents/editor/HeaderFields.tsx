import { Link } from 'react-router'
import { CustomFieldInput } from '@/components/CustomFieldInput'
import { Select, TextInput } from '@/components/ui'
import { fieldsFor } from '@/domain/fields'
import type { Customer, Document, Settings, Template } from '@/domain/types'

/** Kopfdaten des Dokuments: Kunde, Daten, Template und eigene Dokumentfelder. */
export function HeaderFields({ doc, settings, customers, templates, readOnly, invalidPaths, update }: {
  doc: Document
  settings: Settings
  customers: Customer[]
  templates: Template[]
  readOnly: boolean
  invalidPaths: Set<string>
  update(fn: (d: Document) => Document): void
}) {
  const set = (patch: Partial<Document>) => update((d) => ({ ...d, ...patch }))
  const customer = customers.find((c) => c.id === doc.customerId) ?? doc.snapshot?.customer ?? null
  const docDefs = fieldsFor(settings.fieldDefs, 'document', doc.type)
  const usable = templates.filter((t) => t.manifest.documentTypes.includes(doc.type))
  const template = templates.find((t) => t.id === doc.templateId)
  const missingFields = (template?.manifest.expectedFields ?? []).filter((f) => !settings.fieldDefs.some((d) => d.scope === f.scope && d.key === f.key))
  const err = (path: string, text: string) => (invalidPaths.has(path) ? text : undefined)

  return (
    <div className="stack">
      <div className="hf-grid">
        <Select label="Kunde" value={doc.customerId ?? ''} disabled={readOnly} path="document.customer" wrapClassName="hf-span-2"
          error={err('document.customer', 'Wähle einen Kunden.')}
          aside={customer && <Link className="hf-link" to={`/customers/${customer.id}`}>Kunde öffnen</Link>}
          onChange={(e) => {
            const c = customers.find((x) => x.id === e.target.value)
            set({ customerId: c?.id ?? null, contactId: c?.contacts.find((x) => x.isDefault)?.id ?? null })
          }}>
          <option value="">Kunde wählen</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select label="Ansprechpartner" value={doc.contactId ?? ''} disabled={readOnly || !customer?.contacts.length} onChange={(e) => set({ contactId: e.target.value || null })}>
          <option value="">{customer?.contacts.length ? 'Ohne Ansprechpartner' : 'Keine hinterlegt'}</option>
          {customer?.contacts.map((c) => <option key={c.id} value={c.id}>{`${c.firstName} ${c.lastName}`.trim()}</option>)}
        </Select>
        <TextInput label="Datum" type="date" value={doc.date} disabled={readOnly} path="document.date" error={err('document.date', 'Datum fehlt.')} onChange={(e) => set({ date: e.target.value })} />

        {doc.type === 'offer' && (
          <TextInput label="Gültig bis" type="date" value={doc.validUntil ?? ''} disabled={readOnly} onChange={(e) => set({ validUntil: e.target.value || null })} />
        )}
        {(doc.type === 'invoice' || doc.type === 'cancellation') && (
          <>
            <TextInput label="Leistung ab" type="date" value={doc.serviceDate ?? ''} disabled={readOnly} path="document.service_date"
              error={err('document.service_date', 'Leistungsdatum fehlt.')} onChange={(e) => set({ serviceDate: e.target.value || null })} />
            <TextInput label="Leistung bis" type="date" value={doc.serviceDateEnd ?? ''} disabled={readOnly} hint="Leer lassen bei einem Tag" onChange={(e) => set({ serviceDateEnd: e.target.value || null })} />
          </>
        )}
        {doc.type === 'invoice' && (
          <TextInput label="Fällig am" type="date" value={doc.dueDate ?? ''} disabled={readOnly} path="document.due_date"
            error={err('document.due_date', 'Fälligkeit fehlt.')} onChange={(e) => set({ dueDate: e.target.value || null })} />
        )}
        <Select label="Template" value={doc.templateId} disabled={readOnly} onChange={(e) => set({ templateId: e.target.value })}
          hint={missingFields.length ? `Erwartet ${missingFields.map((f) => f.key).join(', ')}, das Feld gibt es hier nicht.` : undefined}>
          {usable.map((t) => <option key={t.id} value={t.id}>{t.manifest.name}</option>)}
          {!usable.some((t) => t.id === doc.templateId) && template && <option value={template.id}>{template.manifest.name}</option>}
        </Select>
      </div>

      {docDefs.length > 0 && (
        <div className="hf-custom">
              <div className="hf-custom__head">
                <span>Eigene Felder</span>
                <Link className="hf-link" to="/fields">Felder verwalten</Link>
              </div>
              <div className="hf-grid">
                {docDefs.map((d) => (
                  <CustomFieldInput key={d.id} def={d} value={doc.custom[d.key]} disabled={readOnly} path={`document.custom.${d.key}`}
                    onChange={(v) => update((x) => ({ ...x, custom: { ...x.custom, [d.key]: v } }))} />
                ))}
              </div>
        </div>
      )}
    </div>
  )
}
