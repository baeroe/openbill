import { useMemo, useState } from 'react'
import { Copy, Download, Frame, PanelRightClose } from 'lucide-react'
import { PagedPreview } from '@/components/PagedPreview'
import { Button, Skeleton, Tabs } from '@/components/ui'
import { generateCiiXml } from '@/domain/einvoice'
import type { TemplateContextInput } from '@/domain/templateContext'
import type { ProfileId, Template } from '@/domain/types'
import { useRenderedDocument } from '@/hooks/useRenderedDocument'
import { toast } from '@/store/toast'
import { useUiStore } from '@/store/ui'

type Tab = 'preview' | 'xml'

export function PreviewPane({ input, profile, templates }: { input: TemplateContextInput; profile: ProfileId; templates: Template[] }) {
  const template = templates.find((t) => t.id === input.doc.templateId) ?? templates[0] ?? null
  const { result, ctx } = useRenderedDocument(input, template)
  const showGuides = useUiStore((s) => s.showGuides)
  const toggleGuides = useUiStore((s) => s.toggleGuides)
  const togglePreview = useUiStore((s) => s.togglePreview)
  const [tab, setTab] = useState<Tab>('preview')
  const [pages, setPages] = useState(1)
  const strict = profile === 'en16931'
  const xml = useMemo(() => (ctx && tab === 'xml' ? generateCiiXml(ctx) : ''), [ctx, tab])
  const active: Tab = strict ? tab : 'preview'

  const copy = () => {
    navigator.clipboard?.writeText(xml).then(() => toast.success('XML kopiert'), () => toast.error('Kopieren ging nicht. Markiere den Text und kopiere ihn selbst.'))
  }

  return (
    <aside className="preview" aria-label="Vorschau">
      <div className="preview__bar">
        {strict
          ? <Tabs<Tab> label="Ansicht" value={active} onChange={setTab} items={[{ value: 'preview', label: 'Vorschau' }, { value: 'xml', label: 'E-Rechnung' }]} />
          : <span className="preview__title">Vorschau</span>}
        <span className="spacer" />
        {active === 'preview' && (
          <button type="button" className="pill" aria-pressed={showGuides} onClick={toggleGuides} title="Hilfslinien für Kopfzeile, Inhalt und Fußzeile">
            <Frame size={14} /><span className="preview__label">Bereiche</span>
          </button>
        )}
        <Button size="sm" variant="ghost" iconOnly icon={<Download />} onClick={() => toast.info('Im Klickdummy gibt es kein PDF. In openbill rendert Gotenberg Inhalt, Kopf- und Fußzeile.')}>PDF herunterladen</Button>
        <Button size="sm" variant="ghost" iconOnly icon={<PanelRightClose />} onClick={togglePreview}>Vorschau ausblenden</Button>
      </div>

      {active === 'preview' ? (
        <div className="preview__body">
          {result.error && <p className="notice notice--bad" role="alert">Das Template enthält einen Fehler. {result.error}</p>}
          {template && result.body
            ? <PagedPreview result={result} paper={template.manifest.paper} showGuides={showGuides} onPageCount={setPages} />
            : <Skeleton h={520} r={4} />}
          <p className="preview__meta">{pages === 1 ? '1 Seite' : `${pages} Seiten`} · Template „{template?.manifest.name ?? '–'}“</p>
        </div>
      ) : (
        <div className="preview__body">
          <div className="xml">
            <div className="xml__bar">
              <span>Vereinfachte XML nach EN 16931 (ZUGFeRD). In openbill steckt sie im PDF.</span>
              <Button size="sm" variant="ghost" icon={<Copy />} onClick={copy}>Kopieren</Button>
            </div>
            <pre className="xml__code" tabIndex={0}>{xml}</pre>
          </div>
        </div>
      )}
    </aside>
  )
}
