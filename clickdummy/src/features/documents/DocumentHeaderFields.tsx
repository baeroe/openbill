import { PROFILE_REQUIREMENTS } from '@/domain/compliance'
import type { Customer, DocTypeConfig, Document } from '@/domain/types'
import { useCustomerStore } from '@/store/customerStore'
import { useDocumentStore } from '@/store/documentStore'
import { useTemplateStore } from '@/store/templateStore'
import { Badge } from '@/ui/Badge'
import { CustomFieldInput, fieldDomId } from '@/ui/CustomFieldInput'
import { Input, Select } from '@/ui/form'
import { Sheet } from '@/ui/Sheet'

export const ProfileBadge = () => <Badge tone="carbon" title="Pflichtangabe für die E-Rechnung">E-Rechnung</Badge>

export function DocumentHeaderFields({ doc, config, customer, locked }: { doc: Document; config: DocTypeConfig; customer: Customer | null; locked: boolean }) {
  const customers = useCustomerStore((s) => s.customers)
  const templates = useTemplateStore((s) => s.templates).filter((t) => t.manifest.documentTypes.includes(doc.type))
  const update = useDocumentStore((s) => s.updateDocument)
  const set = (patch: Partial<Document>) => update(doc.id, patch)
  const strict = config.profile === 'en16931'
  const profileKeys = new Set(PROFILE_REQUIREMENTS[config.profile].filter((r) => r.scope === 'document').map((r) => r.key))
  const pb = (key: string) => (strict && profileKeys.has(key) ? <ProfileBadge /> : undefined)

  return (
    <Sheet title="Kopfdaten">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          id={fieldDomId('document.customer')}
          label="Kunde"
          disabled={locked}
          value={doc.customerId ?? ''}
          onChange={(e) => {
            const c = customers.find((x) => x.id === e.target.value)
            set({ customerId: c?.id ?? null, contactId: c?.contacts.find((x) => x.isDefault)?.id ?? null })
          }}
        >
          <option value="">Kunde wählen</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select label="Ansprechpartner" disabled={locked || !customer} value={doc.contactId ?? ''} onChange={(e) => set({ contactId: e.target.value || null })}>
          <option value="">Keiner</option>
          {customer?.contacts.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}{c.position ? `, ${c.position}` : ''}</option>)}
        </Select>
        <Input label="Datum" type="date" disabled={locked} value={doc.date} onChange={(e) => e.target.value && set({ date: e.target.value })} />
        {doc.type === 'offer' && (
          <Input label="Gültig bis" type="date" disabled={locked} value={doc.validUntil ?? ''} onChange={(e) => set({ validUntil: e.target.value || null })} />
        )}
        {doc.type === 'invoice' && (
          <Input id={fieldDomId('document.due_date')} label="Fällig am" badge={pb('due_date')} type="date" disabled={locked} value={doc.dueDate ?? ''} onChange={(e) => set({ dueDate: e.target.value || null })} />
        )}
        {doc.type !== 'offer' && (
          <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:grid-cols-[1fr_1fr_1fr] sm:gap-4">
            <Input id={fieldDomId('document.service_date')} label="Leistungsdatum" badge={pb('service_date')} type="date" disabled={locked} value={doc.serviceDate ?? ''} onChange={(e) => set({ serviceDate: e.target.value || null })} />
            <Input label="Leistung bis (optional)" type="date" disabled={locked} value={doc.serviceDateEnd ?? ''} onChange={(e) => set({ serviceDateEnd: e.target.value || null })} />
          </div>
        )}
        <Select label="Template" disabled={locked} value={doc.templateId} onChange={(e) => set({ templateId: e.target.value })} wrapClassName="sm:col-span-2">
          {templates.map((t) => <option key={t.id} value={t.id}>{t.manifest.name}</option>)}
        </Select>
      </div>

      {config.documentFields.length > 0 && (
        <div className="mt-5 grid gap-4 border-t border-dashed border-line pt-5 sm:grid-cols-2">
          {config.documentFields.map((def) => (
            <CustomFieldInput
              key={def.id}
              id={fieldDomId(`document.custom.${def.key}`)}
              def={def}
              value={doc.custom[def.key]}
              disabled={locked}
              onChange={(v) => set({ custom: { ...doc.custom, [def.key]: v } })}
            />
          ))}
        </div>
      )}
    </Sheet>
  )
}
