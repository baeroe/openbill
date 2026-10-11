import { ImagePlus, X } from 'lucide-react'
import type { Organization, TaxationMode } from '@/domain/types'
import { useSettingsStore } from '@/store/settingsStore'
import { Button } from '@/ui/Button'
import { CustomFieldInput, fieldDomId, readImage } from '@/ui/CustomFieldInput'
import { Checkbox, Input } from '@/ui/form'
import { Sheet } from '@/ui/Sheet'
import { useHashFocus } from '@/ui/useHashFocus'
import { FieldBuilder } from './FieldBuilder'

const MODES: { id: TaxationMode; label: string; hint: string }[] = [
  { id: 'regular', label: 'Regelbesteuerung', hint: 'Umsatzsteuer nach den Steuersätzen der Positionen.' },
  { id: 'small_business', label: 'Kleinunternehmer (§ 19 UStG)', hint: 'Keine Umsatzsteuer auf Dokumenten. Der gesetzliche Hinweis wird automatisch ergänzt. Bereits abgeschlossene Dokumente bleiben unverändert.' },
]

export function OrganizationSettings() {
  const { org, updateOrg, fieldDefs } = useSettingsStore()
  useHashFocus()
  const set = (patch: Partial<Organization>) => updateOrg(patch)
  const setAddress = (patch: Partial<Organization['address']>) => updateOrg({ address: { ...org.address, ...patch } })

  return (
    <div className="grid gap-5">
      <Sheet title="Unternehmen" description="Erscheint als Absender auf allen Dokumenten.">
        <div className="mb-5 flex items-center gap-4">
          <div className="grid h-16 w-40 place-items-center rounded-[3px] border border-dashed border-line-strong bg-sheet-2">
            {org.logo ? <img src={org.logo} alt="Logo" className="max-h-14 max-w-36 object-contain" /> : <span className="text-xs text-faint">Kein Logo</span>}
          </div>
          <label htmlFor="org-logo" className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[5px] border border-line-strong bg-sheet px-2.5 text-[13px] font-medium hover:bg-sheet-2">
            <ImagePlus size={14} /> Logo hochladen
          </label>
          <input id="org-logo" type="file" accept="image/*" className="sr-only" onChange={(e) => readImage(e.target.files?.[0], (logo) => set({ logo }))} />
          {org.logo && <Button size="sm" variant="ghost" icon={<X size={14} />} onClick={() => set({ logo: null })}>Entfernen</Button>}
        </div>
        <div className="grid gap-4 sm:grid-cols-6">
          <Input label="Firmenname" value={org.name} onChange={(e) => set({ name: e.target.value })} wrapClassName="sm:col-span-6" />
          <Input id={fieldDomId('org.address')} label="Straße und Hausnummer" value={org.address.street} onChange={(e) => setAddress({ street: e.target.value })} wrapClassName="sm:col-span-6" />
          <Input label="PLZ" value={org.address.zip} onChange={(e) => setAddress({ zip: e.target.value })} wrapClassName="sm:col-span-2" />
          <Input label="Ort" value={org.address.city} onChange={(e) => setAddress({ city: e.target.value })} wrapClassName="sm:col-span-3" />
          <Input label="Land" maxLength={2} value={org.address.country} onChange={(e) => setAddress({ country: e.target.value.toUpperCase() })} wrapClassName="sm:col-span-1" />
          <Input label="E-Mail" value={org.email} onChange={(e) => set({ email: e.target.value })} wrapClassName="sm:col-span-2" />
          <Input label="Telefon" value={org.phone} onChange={(e) => set({ phone: e.target.value })} wrapClassName="sm:col-span-2" />
          <Input label="Website" value={org.website} onChange={(e) => set({ website: e.target.value })} wrapClassName="sm:col-span-2" />
        </div>
      </Sheet>

      <Sheet title="Steuern und Bank">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id={fieldDomId('org.vat_id')} label="USt-ID" value={org.vatId} onChange={(e) => set({ vatId: e.target.value })} />
          <Input label="Steuernummer" value={org.taxNumber} onChange={(e) => set({ taxNumber: e.target.value })} />
          <Input id={fieldDomId('org.iban')} label="IBAN" value={org.iban} onChange={(e) => set({ iban: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="BIC" value={org.bic} onChange={(e) => set({ bic: e.target.value })} />
            <Input label="Bank" value={org.bankName} onChange={(e) => set({ bankName: e.target.value })} />
          </div>
        </div>
        <div role="radiogroup" aria-label="Besteuerungsart" className="mt-5 grid gap-3 border-t border-dashed border-line pt-5">
          {MODES.map((m) => (
            <Checkbox key={m.id} type="radio" name="taxation" label={m.label} hint={m.hint} checked={org.taxationMode === m.id} onChange={() => set({ taxationMode: m.id })} />
          ))}
        </div>
      </Sheet>

      {fieldDefs.org.length > 0 && (
        <Sheet title="Weitere Angaben" description="Werte deiner eigenen Organisationsfelder.">
          <div className="grid gap-4 sm:grid-cols-2">
            {fieldDefs.org.map((def) => (
              <CustomFieldInput key={def.id} id={fieldDomId(`org.${def.key}`)} def={def} value={org.custom[def.key]} onChange={(v) => set({ custom: { ...org.custom, [def.key]: v } })} />
            ))}
          </div>
        </Sheet>
      )}

      <FieldBuilder target={{ scope: 'org' }} prefix="org" title="Eigene Organisationsfelder" description="Zum Beispiel Handelsregister, Geschäftsführung oder ein Zweitlogo." />
    </div>
  )
}
