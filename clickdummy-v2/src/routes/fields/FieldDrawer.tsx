import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { CustomFieldInput } from '@/components/CustomFieldInput'
import { Button, Checkbox, Drawer, Field, Switch, Textarea, TextInput, cx } from '@/components/ui'
import { FIELD_TYPE_LABELS, SCOPE_LABELS, SCOPE_LIQUID, scopeHasDocTypes, slugifyKey, validateFieldDef } from '@/domain/fields'
import { DOC_TYPE_LABELS } from '@/domain/lifecycle'
import { DOC_TYPES, type FieldDef, type FieldType } from '@/domain/types'
import { useSaveFieldDef } from '@/hooks/useSettings'
import { toast } from '@/store/toast'


const TYPES = Object.keys(FIELD_TYPE_LABELS) as FieldType[]

export function FieldDrawer({ def: initial, allDefs, onClose }: { def: FieldDef; allDefs: FieldDef[]; onClose(): void }) {
  const isNew = !initial.id
  const [def, setDef] = useState<FieldDef>(() => (isNew && initial.label && !initial.key ? { ...initial, key: slugifyKey(initial.label) } : initial))
  const [keyTouched, setKeyTouched] = useState(!isNew)
  const [touched, setTouched] = useState(false)
  const [newOption, setNewOption] = useState('')
  const save = useSaveFieldDef()
  const set = (patch: Partial<FieldDef>) => setDef((d) => ({ ...d, ...patch }))

  const errors = useMemo(() => validateFieldDef({ ...def, id: def.id || '__new__' }, allDefs), [def, allDefs])
  const showErrors = touched && errors.length > 0
  const withTypes = scopeHasDocTypes(def.scope)

  const setType = (type: FieldType) => set({ type, defaultValue: null, options: type === 'select' ? def.options : [] })
  const addOption = () => {
    const o = newOption.trim()
    if (!o || def.options.includes(o)) return
    set({ options: [...def.options, o] })
    setNewOption('')
  }

  const submit = () => {
    setTouched(true)
    if (errors.length) return
    save.mutate(def, {
      onSuccess: (saved) => { toast.success(isNew ? `Feld „${saved.label}“ angelegt` : `Feld „${saved.label}“ gespeichert`); onClose() },
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <Drawer open onClose={onClose}
      title={isNew ? 'Feld hinzufügen' : `${initial.label} bearbeiten`}
      description={`Ebene: ${SCOPE_LABELS[def.scope]}`}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
        <Button variant="primary" pending={save.isPending} onClick={submit}>{isNew ? 'Feld anlegen' : 'Speichern'}</Button>
      </>}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <TextInput label="Bezeichnung" value={def.label} data-autofocus placeholder="z. B. Bestellnummer des Kunden"
          onChange={(e) => set({ label: e.target.value, ...(isNew && !keyTouched ? { key: slugifyKey(e.target.value) } : {}) })} />
        <TextInput label="Schlüssel" value={def.key} readOnly={!isNew} className="input--code"
          hint={isNew ? 'Damit greifst du im Template auf das Feld zu. Nach dem Anlegen lässt er sich nicht mehr ändern.' : 'Der Schlüssel ist fest, damit Templates und gespeicherte Werte gültig bleiben.'}
          onChange={(e) => { setKeyTouched(true); set({ key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }) }} />

        <Field label="Typ">
          {() => (
            <div className="type-tiles" role="radiogroup" aria-label="Typ">
              {TYPES.map((t) => (
                <button key={t} type="button" role="radio" aria-checked={def.type === t} className={cx('type-tile', def.type === t && 'type-tile--on')} onClick={() => setType(t)}>
                  {FIELD_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          )}
        </Field>

        {def.type === 'select' && (
          <Field label="Optionen">
            {(id) => (
              <div className="stack stack--sm">
                {def.options.length > 0 && (
                  <ul className="option-list">
                    {def.options.map((o) => (
                      <li key={o}>
                        <span>{o}</span>
                        <Button variant="ghost" size="sm" iconOnly icon={<X />} onClick={() => set({ options: def.options.filter((x) => x !== o), defaultValue: def.defaultValue === o ? null : def.defaultValue })}>{`${o} entfernen`}</Button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="row">
                  <input id={id} className="input" value={newOption} placeholder="Neue Option" onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption() } }} />
                  <Button icon={<Plus />} onClick={addOption} disabled={!newOption.trim()}>Hinzufügen</Button>
                </div>
              </div>
            )}
          </Field>
        )}

        {withTypes && (
          <Field label="Gilt für" hint="Beim Umwandeln wandert ein Wert nur mit, wenn das Feld auch für den Zieltyp gilt.">
            {() => (
              <div className="row row--wrap">
                {DOC_TYPES.map((t) => (
                  <Checkbox key={t} label={DOC_TYPE_LABELS[t]} checked={def.docTypes.includes(t)}
                    onChange={(e) => set({ docTypes: e.target.checked ? DOC_TYPES.filter((x) => x === t || def.docTypes.includes(x)) : def.docTypes.filter((x) => x !== t) })} />
                ))}
              </div>
            )}
          </Field>
        )}

        <Switch label="Pflichtfeld: Dokumente lassen sich erst abschließen, wenn es ausgefüllt ist" checked={def.required} onChange={(e) => set({ required: e.target.checked })} />

        <CustomFieldInput def={{ ...def, label: 'Standardwert', required: false, help: 'Wird bei neuen Einträgen vorausgefüllt.' }} value={def.defaultValue} onChange={(v) => set({ defaultValue: v })} />

        <Textarea label="Hilfetext" value={def.help} rows={2} placeholder="Erscheint unter dem Feld im Formular" onChange={(e) => set({ help: e.target.value })} />

        {showErrors && (
          <div className="notice notice--bad" role="alert">
            <ul className="error-list">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}
      </form>

      <section className="field-preview" aria-label="Vorschau">
        <p className="field-preview__title">So sieht es aus</p>
        <div className="field-preview__form">
          <CustomFieldInput def={{ ...def, label: def.label || 'Neues Feld' }} value={def.defaultValue} onChange={() => {}} />
        </div>
        <p className="muted">Im Template: <code className="key">{`{{ ${SCOPE_LIQUID[def.scope]}.${def.key || 'schluessel'} }}`}</code></p>
      </section>
    </Drawer>
  )
}
