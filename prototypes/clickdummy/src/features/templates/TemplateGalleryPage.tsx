import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { CircleAlert, Copy, Download, Pencil, Trash2, Upload } from 'lucide-react'
import { DOC_TYPE_LABELS } from '@/domain/lifecycle'
import type { Template } from '@/domain/types'
import { useDocumentStore } from '@/store/documentStore'
import { useDocumentView } from '@/store/selectors'
import { useSettingsStore } from '@/store/settingsStore'
import { useTemplateStore } from '@/store/templateStore'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { PageHeader } from '@/ui/PageHeader'
import { PagedPreview } from '@/ui/PagedPreview'
import { toast } from '@/ui/Toast'
import { useRenderedDocument } from '../documents/useRenderedDocument'
import { missingExpectedFields } from './expectedFields'

const SAMPLE_DOC = 'doc-offer-1'

function TemplateCard({ template }: { template: Template }) {
  const view = useDocumentView(useDocumentStore.getState().documents.some((d) => d.id === SAMPLE_DOC) ? SAMPLE_DOC : useDocumentStore.getState().documents[0]?.id ?? '')
  const { result } = useRenderedDocument(view?.contextInput ?? null, template, 0)
  const settings = useSettingsStore()
  const { duplicateTemplate, removeTemplate } = useTemplateStore()
  const navigate = useNavigate()
  const missing = missingExpectedFields(template, settings)

  return (
    <article aria-label={template.manifest.name} className="flex flex-col overflow-hidden rounded-[3px] border border-line bg-sheet shadow-sheet">
      <button type="button" onClick={() => navigate(`/templates/${template.id}`)} className="block bg-desk p-5 pb-0">
        <PagedPreview result={result} paper={template.manifest.paper} maxPages={1} maxHeight={300} title={`Vorschau ${template.manifest.name}`} />
      </button>
      <div className="flex flex-1 flex-col gap-2 border-t border-line p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-cond text-lg leading-tight font-semibold">{template.manifest.name}</h2>
            <p className="text-xs text-muted">Version {template.manifest.version} von {template.manifest.author}</p>
          </div>
          {template.builtIn && <Badge>Mitgeliefert</Badge>}
        </div>
        <p className="text-[13px] text-muted">{template.manifest.description}</p>
        <div className="flex flex-wrap gap-1">
          {template.manifest.documentTypes.map((t) => <Badge key={t} tone="blue">{DOC_TYPE_LABELS[t]}</Badge>)}
        </div>
        {missing.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-copy-yellow-ink" title={missing.join(', ')}>
            <CircleAlert size={13} /> {missing.length === 1 ? '1 erwartetes Feld fehlt' : `${missing.length} erwartete Felder fehlen`}: {missing.join(', ')}
          </p>
        )}
        <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
          <Button size="sm" icon={<Pencil size={13} />} onClick={() => navigate(`/templates/${template.id}`)}>{template.builtIn ? 'Ansehen' : 'Bearbeiten'}</Button>
          <Button size="sm" icon={<Copy size={13} />} onClick={() => navigate(`/templates/${duplicateTemplate(template.id)}`)}>Duplizieren</Button>
          <Button size="sm" variant="ghost" icon={<Download size={13} />} onClick={() => toast('Im Klickdummy simuliert: Export als ZIP mit manifest.json, template.liquid und styles.css.', 'warn')}>Export</Button>
          {!template.builtIn && <Button size="sm" variant="ghost" aria-label="Template löschen" icon={<Trash2 size={13} />} onClick={() => removeTemplate(template.id)} />}
        </div>
      </div>
    </article>
  )
}

export function TemplateGalleryPage() {
  const templates = useTemplateStore((s) => s.templates)
  const { duplicateTemplate, upsertTemplate } = useTemplateStore()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [imported, setImported] = useState<string | null>(null)

  const simulateImport = (file: File | undefined) => {
    if (!file) return
    const id = duplicateTemplate('tpl-kante')
    const t = useTemplateStore.getState().templates.find((x) => x.id === id)!
    const name = file.name.replace(/\.zip$/i, '').replace(/[-_]/g, ' ')
    upsertTemplate({ ...t, manifest: { ...t.manifest, name: name.charAt(0).toUpperCase() + name.slice(1), author: 'Community', description: 'Importiert aus einem ZIP-Paket.' } })
    setImported(file.name)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      <PageHeader
        title="Templates"
        meta="HTML und CSS mit Liquid-Platzhaltern. Jedes Template ist ein Paket, das du teilen und importieren kannst."
        actions={
          <>
            <input ref={fileRef} type="file" accept=".zip" aria-label="ZIP-Datei" className="sr-only" onChange={(e) => simulateImport(e.target.files?.[0])} />
            <Button icon={<Upload size={15} />} onClick={() => fileRef.current?.click()}>Template importieren</Button>
            <Button variant="primary" onClick={() => navigate(`/templates/${duplicateTemplate('tpl-klar')}`)}>Neues Template</Button>
          </>
        }
      />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => <TemplateCard key={t.id} template={t} />)}
      </div>
      <Dialog open={!!imported} onClose={() => setImported(null)} title="Template importiert" footer={<Button variant="primary" onClick={() => setImported(null)}>Fertig</Button>}>
        <p className="text-sm text-muted">„{imported}“ wurde geprüft und hinzugefügt. In der echten App wird das Paket so validiert:</p>
        <ul className="mt-3 grid gap-1 text-sm">
          <li>✓ manifest.json gefunden und gültig</li>
          <li>✓ template.liquid lässt sich parsen</li>
          <li>✓ styles.css übernommen</li>
          <li>✓ Liquid läuft in der Sandbox, kein eigener Code ausführbar</li>
        </ul>
      </Dialog>
    </>
  )
}
