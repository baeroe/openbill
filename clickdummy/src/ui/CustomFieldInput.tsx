import type { ReactNode } from 'react'
import { ImagePlus, X } from 'lucide-react'
import type { FieldDef, FieldValue } from '@/domain/types'
import { Button } from './Button'
import { Checkbox, Input, Select, Textarea } from './form'
import { NumberInput } from './NumberInput'

export const fieldDomId = (path: string) => `field-${path}`

/** Rendert ein eigenes Feld passend zu seinem Typ. */
export function CustomFieldInput({ def, value, onChange, disabled, id, error, badge }: {
  def: FieldDef
  value: FieldValue | undefined
  onChange(v: FieldValue): void
  disabled?: boolean
  id: string
  error?: string
  badge?: ReactNode
}) {
  const label = <>{def.label}{def.required && <span className="text-danger">*</span>}</>
  const common = { id, disabled, error, hint: def.help || undefined, label, badge }
  switch (def.type) {
    case 'textarea':
      return <Textarea {...common} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
    case 'number':
    case 'money':
      return (
        <div className="flex flex-col gap-1">
          <label htmlFor={id} className="text-[13px] font-medium text-muted">{label}</label>
          <div className="relative">
            <NumberInput id={id} disabled={disabled} value={Number(value ?? 0)} onValue={onChange} decimals={def.type === 'money' ? 2 : 0} className="h-9 text-left" />
            {def.type === 'money' && <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-faint">€</span>}
          </div>
          {def.help && <p className="text-xs text-faint">{def.help}</p>}
        </div>
      )
    case 'date':
      return <Input {...common} type="date" value={String(value ?? '')} onChange={(e) => onChange(e.target.value || null)} />
    case 'select':
      return (
        <Select {...common} value={String(value ?? '')} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">–</option>
          {def.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
      )
    case 'boolean':
      return <Checkbox id={id} disabled={disabled} label={def.label} hint={def.help || undefined} checked={value === true} onChange={(e) => onChange(e.target.checked)} className="pt-6" />
    case 'image':
      return (
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-muted">{label}</span>
          <div className="flex items-center gap-3">
            {value ? (
              <>
                <img src={String(value)} alt="" className="h-12 max-w-40 rounded-[3px] border border-line object-contain" />
                {!disabled && <Button size="sm" variant="ghost" onClick={() => onChange(null)} icon={<X size={14} />}>Entfernen</Button>}
              </>
            ) : (
              <label htmlFor={id} className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[5px] border border-dashed border-line-strong px-3 text-sm text-muted hover:text-ink">
                <ImagePlus size={15} /> Bild wählen
              </label>
            )}
            <input id={id} type="file" accept="image/*" disabled={disabled} className="sr-only" onChange={(e) => readImage(e.target.files?.[0], onChange)} />
          </div>
        </div>
      )
    default:
      return <Input {...common} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
  }
}

export function readImage(file: File | undefined, done: (dataUrl: string) => void) {
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => done(String(reader.result))
  reader.readAsDataURL(file)
}
