import { DOC_TYPE_LABELS } from '@/domain/lifecycle'
import type { DocType, TemplateManifest } from '@/domain/types'
import { Badge } from '@/ui/Badge'
import { Checkbox, Input, Select, Textarea } from '@/ui/form'

const TYPES: DocType[] = ['offer', 'confirmation', 'invoice', 'cancellation']

export function ManifestForm({ manifest, onChange, readOnly, missing }: { manifest: TemplateManifest; onChange(m: TemplateManifest): void; readOnly: boolean; missing: string[] }) {
  const set = (patch: Partial<TemplateManifest>) => onChange({ ...manifest, ...patch })
  return (
    <div className="grid max-w-2xl gap-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Name" disabled={readOnly} value={manifest.name} onChange={(e) => set({ name: e.target.value })} />
        <Input label="Version" disabled={readOnly} value={manifest.version} onChange={(e) => set({ version: e.target.value })} />
        <Input label="Autor" disabled={readOnly} value={manifest.author} onChange={(e) => set({ author: e.target.value })} />
        <Input label="Lizenz" disabled={readOnly} value={manifest.license} onChange={(e) => set({ license: e.target.value })} />
      </div>
      <Textarea label="Beschreibung" disabled={readOnly} rows={2} value={manifest.description} onChange={(e) => set({ description: e.target.value })} />
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-[13px] font-medium text-muted">Geeignet für</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {TYPES.map((t) => (
            <Checkbox key={t} label={DOC_TYPE_LABELS[t]} disabled={readOnly} checked={manifest.documentTypes.includes(t)}
              onChange={(e) => set({ documentTypes: e.target.checked ? [...manifest.documentTypes, t] : manifest.documentTypes.filter((x) => x !== t) })} />
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Papierformat" disabled={readOnly} value={manifest.paper.format} onChange={(e) => set({ paper: { ...manifest.paper, format: e.target.value as 'A4' | 'Letter' } })}>
          <option value="A4">A4</option><option value="Letter">US Letter</option>
        </Select>
        <Input label="Seitenränder (CSS)" mono hint="z. B. 20mm oder 18mm 20mm 22mm" disabled={readOnly} value={manifest.paper.margin} onChange={(e) => set({ paper: { ...manifest.paper, margin: e.target.value } })} />
      </div>
      <div>
        <p className="mb-1 text-[13px] font-medium text-muted">Erwartete eigene Felder</p>
        <p className="mb-2 text-xs text-faint">Damit sieht man beim Import, welche Felder das Template nutzt. Fehlen sie, bleibt die Stelle leer.</p>
        {manifest.expectedFields.length ? (
          <ul className="grid gap-1">
            {manifest.expectedFields.map((f) => {
              const path = `${f.scope}.${f.key}`
              return (
                <li key={path} className="flex items-center gap-2 text-sm">
                  <code className="font-mono text-[12.5px]">{path}</code>
                  {missing.includes(path) ? <Badge tone="yellow">nicht angelegt</Badge> : <Badge tone="ok">vorhanden</Badge>}
                </li>
              )
            })}
          </ul>
        ) : <p className="text-sm text-muted">Keine.</p>}
      </div>
    </div>
  )
}
