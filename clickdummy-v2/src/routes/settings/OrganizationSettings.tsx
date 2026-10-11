import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ImagePlus, Trash2 } from 'lucide-react'
import { CustomFieldInput } from '@/components/CustomFieldInput'
import { Button, TextInput, cx } from '@/components/ui'
import { fieldsFor } from '@/domain/fields'
import type { Organization, Settings, TaxationMode } from '@/domain/types'
import { useSettings, useUpdateOrganization } from '@/hooks/useSettings'
import { QueryGate } from '@/layout/RouteState'
import { toast } from '@/store/toast'
import { FormSkeleton } from './SettingsSkeleton'

const TAXATION: { value: TaxationMode; title: string; text: string }[] = [
  { value: 'regular', title: 'Regelbesteuerung', text: 'Du weist Umsatzsteuer aus. Pro Position wählst du den Steuersatz.' },
  { value: 'small_business', title: 'Kleinunternehmer (§ 19 UStG)', text: 'Keine Umsatzsteuer. Der Pflichthinweis kommt automatisch auf jedes Dokument.' },
]

export function OrganizationSettings() {
  const query = useSettings()
  return (
    <QueryGate query={query} loading={<FormSkeleton rows={5} />}>
      {(settings) => <OrganizationForm key={JSON.stringify(settings.org)} settings={settings} />}
    </QueryGate>
  )
}

function OrganizationForm({ settings }: { settings: Settings }) {
  const [org, setOrg] = useState<Organization>(settings.org)
  const save = useUpdateOrganization()
  const dirty = useMemo(() => JSON.stringify(org) !== JSON.stringify(settings.org), [org, settings.org])
  const orgFields = fieldsFor(settings.fieldDefs, 'org')

  const set = (patch: Partial<Organization>) => setOrg((o) => ({ ...o, ...patch }))
  const setAddr = (patch: Partial<Organization['address']>) => setOrg((o) => ({ ...o, address: { ...o.address, ...patch } }))
  const text = (key: keyof Organization, label: string, extra: Partial<React.ComponentProps<typeof TextInput>> = {}) => (
    <TextInput label={label} value={String(org[key] ?? '')} onChange={(e) => set({ [key]: e.target.value } as Partial<Organization>)} {...extra} />
  )

  const onLogo = (file: File | undefined) => {
    if (!file) return
    if (file.size > 1_000_000) { toast.error('Das Logo ist größer als 1 MB. Nimm eine kleinere Datei, am besten SVG oder PNG.'); return }
    const r = new FileReader()
    r.onload = () => set({ logo: String(r.result) })
    r.readAsDataURL(file)
  }

  const submit = () => save.mutate(org, { onSuccess: () => toast.success('Organisation gespeichert'), onError: (e) => toast.error(e.message) })

  return (
    <form className="stack stack--lg enter" onSubmit={(e) => { e.preventDefault(); submit() }}>
      <section className="card">
        <div className="card__head"><div><h2 className="card__title">Firma</h2><p className="card__desc">Steht im Absender, in Kopf- und Fußzeile und in der E-Rechnung.</p></div></div>
        <div className="stack">
          <div className="logo-row">
            <div className={cx('logo-box', !org.logo && 'logo-box--empty')}>
              {org.logo ? <img src={org.logo} alt="Logo" /> : <span>{org.name.slice(0, 2) || 'Lo'}</span>}
            </div>
            <div className="stack stack--sm">
              <div className="row row--wrap">
                <label className="btn btn--sm"><ImagePlus /> {org.logo ? 'Logo ersetzen' : 'Logo hochladen'}<input type="file" accept="image/*" hidden onChange={(e) => onLogo(e.target.files?.[0])} /></label>
                {org.logo && <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => set({ logo: null })}>Entfernen</Button>}
              </div>
              <p className="field__hint">SVG oder PNG, höchstens 1 MB. Ohne Logo zeigen die Templates den Firmennamen.</p>
            </div>
          </div>
          <div className="grid-2">
            {text('name', 'Name', { wrapClassName: 'span-2' })}
            <TextInput label="Straße und Hausnummer" value={org.address.street} onChange={(e) => setAddr({ street: e.target.value })} wrapClassName="span-2" />
            <TextInput label="PLZ" value={org.address.zip} onChange={(e) => setAddr({ zip: e.target.value })} />
            <TextInput label="Ort" value={org.address.city} onChange={(e) => setAddr({ city: e.target.value })} />
            <TextInput label="Land" value={org.address.country} maxLength={2} hint="Ländercode nach ISO 3166, z. B. DE" onChange={(e) => setAddr({ country: e.target.value.toUpperCase() })} />
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card__head"><div><h2 className="card__title">Besteuerung</h2><p className="card__desc">Bestimmt, welche Steuersätze du an Positionen wählen kannst.</p></div></div>
        <div className="option-cards" role="radiogroup" aria-label="Besteuerungsart">
          {TAXATION.map((t) => (
            <label key={t.value} className={cx('option-card', org.taxationMode === t.value && 'option-card--on')}>
              <input type="radio" name="taxation" value={t.value} checked={org.taxationMode === t.value} onChange={() => set({ taxationMode: t.value })} />
              <span className="option-card__title">{t.title}</span>
              <span className="option-card__text">{t.text}</span>
            </label>
          ))}
        </div>
        <div className="grid-2" style={{ marginTop: 'var(--sp-4)' }}>
          {text('vatId', 'USt-ID', { placeholder: 'DE123456789' })}
          {text('taxNumber', 'Steuernummer', { hint: 'Reicht für die E-Rechnung, wenn du keine USt-ID hast.' })}
        </div>
      </section>

      <section className="card">
        <div className="card__head"><div><h2 className="card__title">Bank und Kontakt</h2><p className="card__desc">Für Zahlungsangaben und die Fußzeile.</p></div></div>
        <div className="grid-2">
          {text('iban', 'IBAN', { wrapClassName: 'span-2', className: 'num' })}
          {text('bic', 'BIC')}
          {text('bankName', 'Bank')}
          {text('email', 'E-Mail', { type: 'email' })}
          {text('phone', 'Telefon', { type: 'tel' })}
          {text('website', 'Website', { wrapClassName: 'span-2' })}
        </div>
      </section>

      <section className="card">
        <div className="card__head">
          <div><h2 className="card__title">Eigene Felder</h2><p className="card__desc">Zusätzliche Angaben zu deiner Firma, im Template unter <code className="key">org.</code></p></div>
          <span className="spacer" />
          <Link to="/fields?scope=org" className="btn btn--sm btn--soft">Felder verwalten</Link>
        </div>
        {orgFields.length ? (
          <div className="grid-2">
            {orgFields.map((d) => <CustomFieldInput key={d.id} def={d} value={org.custom[d.key]} onChange={(v) => set({ custom: { ...org.custom, [d.key]: v } })} />)}
          </div>
        ) : (
          <p className="muted">Noch keine eigenen Felder. Lege sie unter <Link to="/fields?scope=org">Eigene Felder</Link> an, etwa für Handelsregister oder Geschäftsführung.</p>
        )}
      </section>

      <SaveBar dirty={dirty} pending={save.isPending} onReset={() => setOrg(settings.org)} />
    </form>
  )
}

/** Leiste, die bei ungespeicherten Änderungen unten einfährt. */
export function SaveBar({ dirty, pending, onReset, label = 'Speichern' }: { dirty: boolean; pending: boolean; onReset(): void; label?: string }) {
  if (!dirty && !pending) return null
  return (
    <div className="save-bar enter" role="region" aria-label="Ungespeicherte Änderungen">
      <span>Du hast ungespeicherte Änderungen.</span>
      <span className="spacer" />
      <Button size="sm" variant="ghost" onClick={onReset} disabled={pending}>Verwerfen</Button>
      <Button size="sm" variant="primary" type="submit" pending={pending}>{label}</Button>
    </div>
  )
}
