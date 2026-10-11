import { ImagePlus, X } from 'lucide-react'
import type { FieldDef, FieldValue } from '@/domain/types'
import { Button, Field, NumberInput } from './ui'

/** Eingabe für ein eigenes Feld, passend zum Feldtyp. */
export function CustomFieldInput({ def, value, onChange, disabled, path, compact }: { def: FieldDef; value: FieldValue | undefined; onChange(v: FieldValue): void; disabled?: boolean; path?: string; compact?: boolean }) {
  const label = compact ? undefined : <>{def.label}{def.required && <span aria-hidden> *</span>}</>
  const hint = compact ? undefined : def.help || undefined
  const str = value === null || value === undefined ? '' : String(value)
  return (
    <Field label={label} hint={hint} path={path}>
      {(id) => {
        switch (def.type) {
          case 'textarea':
            return <textarea id={id} className="textarea" value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-label={compact ? def.label : undefined} />
          case 'number':
          case 'money':
            return (
              <div className="input-group">
                <NumberInput id={id} value={typeof value === 'number' ? value : 0} decimals={def.type === 'money' ? 2 : 3} disabled={disabled} onValue={onChange} aria-label={compact ? def.label : undefined} style={def.type === 'money' ? { paddingRight: '2rem' } : undefined} />
                {def.type === 'money' && <span className="input-group__suffix">€</span>}
              </div>
            )
          case 'date':
            return <input id={id} type="date" className="input" value={str} disabled={disabled} onChange={(e) => onChange(e.target.value || null)} aria-label={compact ? def.label : undefined} />
          case 'select':
            return (
              <select id={id} className="select" value={str} disabled={disabled} onChange={(e) => onChange(e.target.value || null)} aria-label={compact ? def.label : undefined}>
                <option value="">Keine Auswahl</option>
                {def.options.map((o) => <option key={o}>{o}</option>)}
              </select>
            )
          case 'boolean':
            return (
              <label className="switch" style={{ height: 'var(--control-h)' }}>
                <input id={id} type="checkbox" role="switch" checked={value === true} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
                <span>{value === true ? 'Ja' : 'Nein'}</span>
              </label>
            )
          case 'image':
            return str ? (
              <div className="row">
                <img src={str} alt="" style={{ height: 48, borderRadius: 8, background: 'var(--surface-2)' }} />
                {!disabled && <Button size="sm" variant="ghost" icon={<X />} onClick={() => onChange(null)}>Entfernen</Button>}
              </div>
            ) : (
              <label className="btn btn--sm" style={{ justifySelf: 'start' }} aria-disabled={disabled}>
                <ImagePlus /> Bild wählen
                <input id={id} type="file" accept="image/*" hidden disabled={disabled} onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const r = new FileReader()
                  r.onload = () => onChange(String(r.result))
                  r.readAsDataURL(f)
                }} />
              </label>
            )
          default:
            return <input id={id} className="input" value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-label={compact ? def.label : undefined} />
        }
      }}
    </Field>
  )
}
