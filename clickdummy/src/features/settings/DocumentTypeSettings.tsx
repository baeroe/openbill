import { useParams } from 'react-router'
import { PROFILE_DESCRIPTIONS, PROFILE_LABELS, PROFILE_REQUIREMENTS, PROFILE_TYPES } from '@/domain/compliance'
import { allocateNumber } from '@/domain/numbering'
import { DOC_TYPE_LABELS } from '@/domain/lifecycle'
import type { DocType, ProfileId } from '@/domain/types'
import { useSettingsStore } from '@/store/settingsStore'
import { useTemplateStore } from '@/store/templateStore'
import { Checkbox, Input, Select } from '@/ui/form'
import { NumberInput } from '@/ui/NumberInput'
import { Sheet } from '@/ui/Sheet'
import { FieldBuilder, type CoreField } from './FieldBuilder'

const PROFILES: ProfileId[] = ['basic', 'en16931']

export function DocumentTypeSettings() {
  const { type = 'invoice' } = useParams() as { type: DocType }
  const { docTypes, updateDocType, textBlocks } = useSettingsStore()
  const templates = useTemplateStore((s) => s.templates).filter((t) => t.manifest.documentTypes.includes(type))
  const config = docTypes[type]
  if (!config) return null
  const strict = config.profile === 'en16931'
  const req = (scope: string) => new Set(PROFILE_REQUIREMENTS[config.profile].filter((r) => r.scope === scope).map((r) => r.key))
  const docReq = req('document')
  const posReq = req('position')

  const docCore: CoreField[] = [
    { key: 'number', label: 'Nummer' }, { key: 'date', label: 'Datum' }, { key: 'customer', label: 'Kunde' }, { key: 'contact', label: 'Ansprechpartner' },
    ...(type === 'offer' ? [{ key: 'valid_until', label: 'Gültig bis' }] : []),
    ...(type !== 'offer' ? [{ key: 'service_date', label: 'Leistungsdatum', profile: strict && docReq.has('service_date') }] : []),
    ...(type === 'invoice' ? [{ key: 'due_date', label: 'Fälligkeit', profile: strict && docReq.has('due_date') }] : []),
    { key: 'intro', label: 'Einleitung' }, { key: 'closing', label: 'Schlusstext' },
  ]
  const posCore: CoreField[] = [
    { key: 'title', label: 'Bezeichnung' }, { key: 'description', label: 'Beschreibung' },
    { key: 'quantity', label: 'Menge', profile: strict && posReq.has('quantity') }, { key: 'unit', label: 'Einheit', profile: strict && posReq.has('unit') },
    { key: 'unit_price', label: 'Einzelpreis' }, { key: 'tax_percent', label: 'Steuersatz' }, { key: 'category', label: 'Kategorie' },
  ]
  const nextNumber = allocateNumber(config.numbering, new Date()).number
  const blocks = (kinds: string[]) => textBlocks.filter((b) => kinds.includes(b.kind))

  return (
    <div className="grid gap-5">
      <Sheet title="Konformitätsprofil" description="Legt fest, welche Angaben Pflicht sind und welche Exporte entstehen.">
        <div role="radiogroup" className="grid gap-3">
          {PROFILES.map((p) => (
            <Checkbox
              key={p}
              type="radio"
              name="profile"
              label={PROFILE_LABELS[p]}
              hint={PROFILE_TYPES[p].includes(type) ? PROFILE_DESCRIPTIONS[p] : `Nur für ${PROFILE_TYPES[p].map((t) => DOC_TYPE_LABELS[t]).join(' und ')} verfügbar.`}
              disabled={!PROFILE_TYPES[p].includes(type)}
              checked={config.profile === p}
              onChange={() => updateDocType(type, { profile: p })}
            />
          ))}
        </div>
        {strict && (
          <div className="mt-4 rounded-[3px] bg-carbon-soft/50 px-4 py-3 text-[13px]">
            <p className="mb-1 font-medium text-carbon">Zusätzliche Pflichtangaben</p>
            <ul className="grid gap-0.5 text-muted sm:grid-cols-2">
              {PROFILE_REQUIREMENTS.en16931.map((r) => (
                <li key={`${r.scope}.${r.key}`}>{{ org: 'Organisation', customer: 'Kunde', document: 'Dokument', position: 'Position' }[r.scope]}: {r.label}</li>
              ))}
            </ul>
          </div>
        )}
      </Sheet>

      <Sheet title="Nummernkreis" description="Platzhalter: {YYYY} Jahr, {YY} kurzes Jahr, {MM} Monat, {0000} laufende Nummer mit Stellenzahl.">
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Input label="Nummernmuster" mono value={config.numbering.pattern} onChange={(e) => updateDocType(type, { numbering: { ...config.numbering, pattern: e.target.value } })} />
          <div className="flex flex-col gap-1">
            <label htmlFor="next-seq" className="text-[13px] font-medium text-muted">Nächste laufende Nr.</label>
            <NumberInput id="next-seq" decimals={0} value={config.numbering.nextSeq} onValue={(n) => updateDocType(type, { numbering: { ...config.numbering, nextSeq: Math.max(1, Math.round(n)) } })} className="h-9" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Checkbox label="Jedes Jahr wieder bei 1 beginnen" checked={config.numbering.resetYearly} onChange={(e) => updateDocType(type, { numbering: { ...config.numbering, resetYearly: e.target.checked } })} />
          <p className="text-sm text-muted">Nächste Nummer: <span data-testid="next-number" className="font-cond text-base font-semibold text-ink">{nextNumber}</span></p>
        </div>
      </Sheet>

      <Sheet title="Standardwerte für neue Dokumente">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Template" value={config.templateId} onChange={(e) => updateDocType(type, { templateId: e.target.value })}>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.manifest.name}</option>)}
          </Select>
          {type === 'invoice' && (
            <div className="flex flex-col gap-1">
              <label htmlFor="term" className="text-[13px] font-medium text-muted">Zahlungsziel in Tagen</label>
              <NumberInput id="term" decimals={0} value={config.paymentTermDays ?? 0} onValue={(n) => updateDocType(type, { paymentTermDays: Math.round(n) })} className="h-9" />
            </div>
          )}
          {type === 'offer' && (
            <div className="flex flex-col gap-1">
              <label htmlFor="validity" className="text-[13px] font-medium text-muted">Gültigkeit in Tagen</label>
              <NumberInput id="validity" decimals={0} value={config.validityDays ?? 0} onValue={(n) => updateDocType(type, { validityDays: Math.round(n) })} className="h-9" />
            </div>
          )}
          <Select label="Einleitung" value={config.defaultIntroBlockId ?? ''} onChange={(e) => updateDocType(type, { defaultIntroBlockId: e.target.value || null })}>
            <option value="">Leer</option>
            {blocks(['intro', 'note']).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <Select label="Schlusstext" value={config.defaultClosingBlockId ?? ''} onChange={(e) => updateDocType(type, { defaultClosingBlockId: e.target.value || null })}>
            <option value="">Leer</option>
            {blocks(['closing', 'payment', 'note']).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </div>
      </Sheet>

      <FieldBuilder target={{ scope: 'document', docType: type }} prefix="document" core={docCore} addLabel="Dokumentfeld hinzufügen" title="Felder am Dokument" description="Gesperrte Felder gehören zum Kern. Eigene Felder erscheinen im Editor und im Template." />
      <FieldBuilder target={{ scope: 'position', docType: type }} prefix="p" core={posCore} addLabel="Positionsfeld hinzufügen" title="Felder an Positionen" description="Eigene Positionsfelder stehen in den Details jeder Position." />
    </div>
  )
}
