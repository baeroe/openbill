import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Copy, Eye, FileArchive, MoreHorizontal, Pencil, SquareCode, Trash2, Upload } from 'lucide-react'
import { Badge, Button, ButtonLink, Dialog, EmptyState, ErrorState, Menu, MenuItem, PageHeader, Skeleton } from '@/components/ui'
import { DOC_TYPE_LABELS } from '@/domain/lifecycle'
import { DOC_TYPES, type Settings, type Template } from '@/domain/types'
import { useSettings } from '@/hooks/useSettings'
import { useDeleteTemplate, useDuplicateTemplate, useImportTemplate, useTemplates } from '@/hooks/useTemplates'
import { toast } from '@/store/toast'
import { TemplatePreview } from './TemplatePreview'
import { useSampleContext } from './useSampleContext'
import './templates.css'

const PACKAGE_FILES: [string, string][] = [
  ['manifest.json', 'Name, Version, Autor, Lizenz, Dokumenttypen, erwartete eigene Felder und Papierformat'],
  ['header.liquid', 'Kopfzeile, steht auf jeder Seite im oberen Rand'],
  ['template.liquid', 'Inhalt mit Adresse, Positionen und Summen, fließt über beliebig viele Seiten'],
  ['footer.liquid', 'Fußzeile, steht auf jeder Seite im unteren Rand, auch mit Seitenzahl'],
  ['styles.css', 'Gestaltung des Inhalts. Kopf- und Fußzeile bringen ihr eigenes <style> mit'],
  ['assets/', 'Optional: Schriften und Grafiken'],
]

export function TemplateGalleryPage() {
  const templates = useTemplates()
  const settings = useSettings()
  const sample = useSampleContext()
  const importTemplate = useImportTemplate()
  const fileInput = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const onFile = (file: File | undefined) => {
    if (!file) return
    importTemplate.mutate(file.name, {
      onSuccess: (t) => toast.success(`„${t.manifest.name}“ importiert`, { label: 'Öffnen', run: () => navigate(`/templates/${t.id}`) }),
      onError: (e) => toast.error(e.message),
    })
  }

  const error = templates.error ?? settings.error
  return (
    <div className="page">
      <PageHeader
        title="Templates"
        description="Templates legen fest, wie deine Dokumente als PDF aussehen. Sie bestehen aus HTML, CSS und Liquid und lassen sich als ZIP weitergeben."
        actions={
          <>
            <input ref={fileInput} type="file" accept=".zip,application/zip" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
            <Button variant="primary" icon={<Upload />} pending={importTemplate.isPending} onClick={() => fileInput.current?.click()}>ZIP importieren</Button>
          </>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={() => { templates.refetch(); settings.refetch() }} />
      ) : !templates.data || !settings.data ? (
        <div className="tpl-grid" aria-busy="true" aria-label="Templates werden geladen">
          {[0, 1, 2].map((i) => (
            <div key={i} className="tpl-skel-card">
              <Skeleton h={240} r={0} />
              <div className="stack stack--sm" style={{ padding: 'var(--sp-4) var(--sp-5) var(--sp-5)' }}>
                <Skeleton w="45%" h={16} /><Skeleton w="90%" h={12} /><Skeleton w="60%" h={12} />
              </div>
            </div>
          ))}
        </div>
      ) : templates.data.length === 0 ? (
        <div className="card">
          <EmptyState icon={<SquareCode />} title="Noch keine Templates"
            actions={<Button variant="primary" icon={<Upload />} onClick={() => fileInput.current?.click()}>ZIP importieren</Button>}>
            Importiere ein Template-Paket, um Dokumente als PDF auszugeben.
          </EmptyState>
        </div>
      ) : (
        <div className="tpl-grid enter">
          {templates.data.map((t) => <TemplateCard key={t.id} template={t} settings={settings.data!} input={sample.input} />)}
        </div>
      )}

      <section className="card tpl-package" aria-labelledby="pkg-title">
        <div>
          <div className="row" style={{ gap: 'var(--sp-2)' }}><FileArchive size={18} aria-hidden /><h2 id="pkg-title">Was steckt in einem Template-Paket?</h2></div>
          <p>Ein Paket ist eine ZIP-Datei. Kopf- und Fußzeile laufen wie bei Gotenberg in einem eigenen Kontext: ohne das CSS des Inhalts, ohne JavaScript und ohne externe Dateien. Bilder wie das Logo kommen als Data-URL hinein.</p>
        </div>
        <ul className="tpl-files">
          {PACKAGE_FILES.map(([file, text]) => <li key={file}><span className="key">{file}</span><span>{text}</span></li>)}
        </ul>
      </section>
    </div>
  )
}

function TemplateCard({ template, settings, input }: { template: Template; settings: Settings; input: ReturnType<typeof useSampleContext>['input'] }) {
  const duplicate = useDuplicateTemplate()
  const remove = useDeleteTemplate()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const { manifest } = template
  const defaultFor = DOC_TYPES.filter((type) => settings.docTypes[type].templateId === template.id)
  const href = `/templates/${template.id}`

  const onDuplicate = () => duplicate.mutate(template.id, {
    onSuccess: (copy) => toast.success(`„${copy.manifest.name}“ angelegt`, { label: 'Bearbeiten', run: () => navigate(`/templates/${copy.id}`) }),
    onError: (e) => toast.error(e.message),
  })

  return (
    <article className="tpl-card">
      <a className="tpl-card__thumb" href={href} onClick={(e) => { e.preventDefault(); navigate(href) }} aria-label={`${manifest.name} ${template.builtIn ? 'ansehen' : 'bearbeiten'}`}>
        <TemplatePreview template={template} input={input} maxPages={1} title={`Vorschau von ${manifest.name}`} />
      </a>
      <div className="tpl-card__body">
        <div className="tpl-card__title">
          <h2>{manifest.name}</h2>
          {template.builtIn && <Badge plain>Mitgeliefert</Badge>}
          <span className="spacer" />
          <span className="muted num" style={{ fontSize: 'var(--text-xs)' }}>v{manifest.version}</span>
        </div>
        {manifest.description && <p className="tpl-card__desc">{manifest.description}</p>}
        <div className="tpl-card__meta" aria-label="Dokumenttypen">
          {manifest.documentTypes.map((type) => (
            <span key={type} className={defaultFor.includes(type) ? 'tag' : 'tag tag--neutral'} title={defaultFor.includes(type) ? `Standard für ${DOC_TYPE_LABELS[type]}` : undefined}>
              {DOC_TYPE_LABELS[type]}{defaultFor.includes(type) && ' · Standard'}
            </span>
          ))}
        </div>
        <div className="tpl-card__foot">
          <ButtonLink to={href} size="sm" variant={template.builtIn ? 'default' : 'soft'} icon={template.builtIn ? <Eye /> : <Pencil />}>
            {template.builtIn ? 'Ansehen' : 'Bearbeiten'}
          </ButtonLink>
          <Button size="sm" variant="ghost" icon={<Copy />} pending={duplicate.isPending} onClick={onDuplicate}>Duplizieren</Button>
          <span className="spacer" />
          {!template.builtIn && (
            <Menu trigger={({ toggle, ref, open }) => (
              <Button ref={ref} size="sm" variant="ghost" iconOnly icon={<MoreHorizontal />} onClick={toggle} aria-haspopup="menu" aria-expanded={open}>Weitere Aktionen</Button>
            )}>
              {(close) => <MenuItem danger icon={<Trash2 />} onClick={() => { close(); setConfirm(true) }}>Löschen</MenuItem>}
            </Menu>
          )}
        </div>
      </div>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={`„${manifest.name}“ löschen?`}
        description="Das Template verschwindet aus der Liste. Abgeschlossene Dokumente behalten ihr PDF."
        footer={<>
          <Button variant="ghost" onClick={() => setConfirm(false)}>Abbrechen</Button>
          <Button variant="danger" pending={remove.isPending} onClick={() => remove.mutate(template.id, {
            onSuccess: () => { setConfirm(false); toast.success(`„${manifest.name}“ gelöscht`) },
            onError: (e) => { setConfirm(false); toast.error(e.message) },
          })}>Löschen</Button>
        </>} />
    </article>
  )
}
