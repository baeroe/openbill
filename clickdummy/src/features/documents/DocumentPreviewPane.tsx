import { useMemo, useState } from 'react'
import { Copy, Download } from 'lucide-react'
import { generateCiiXml } from '@/domain/einvoice'
import type { TemplateContextInput } from '@/domain/templateContext'
import type { ProfileId } from '@/domain/types'
import { useTemplateStore } from '@/store/templateStore'
import { Button } from '@/ui/Button'
import { GuidesToggle } from '@/ui/GuidesToggle'
import { PagedPreview } from '@/ui/PagedPreview'
import { Tabs } from '@/ui/Tabs'
import { toast } from '@/ui/Toast'
import { useRenderedDocument } from './useRenderedDocument'

export function DocumentPreviewPane({ input, profile }: { input: TemplateContextInput; profile: ProfileId }) {
  const templates = useTemplateStore((s) => s.templates)
  const template = templates.find((t) => t.id === input.doc.templateId) ?? templates[0]
  const { result, ctx } = useRenderedDocument(input, template)
  const [tab, setTab] = useState<'preview' | 'xml'>('preview')
  const [guides, setGuides] = useState(false)
  const [pages, setPages] = useState(1)
  const xml = useMemo(() => (ctx && tab === 'xml' ? generateCiiXml(ctx) : ''), [ctx, tab])
  const strict = profile === 'en16931'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {strict ? (
          <Tabs<'preview' | 'xml'> tabs={[{ id: 'preview', label: 'Vorschau' }, { id: 'xml', label: 'E-Rechnung' }]} value={tab} onChange={setTab} className="border-0" />
        ) : (
          <p className="text-[13px] font-medium text-muted">Vorschau</p>
        )}
        <div className="flex items-center gap-2">
          {tab === 'preview' && <span className="text-xs text-muted" data-testid="page-count">{pages === 1 ? '1 Seite' : `${pages} Seiten`}, „{template?.manifest.name}“</span>}
          {tab === 'preview' && <GuidesToggle value={guides} onChange={setGuides} />}
          <Button size="sm" icon={<Download size={14} />} onClick={() => toast('Im Klickdummy gibt es kein PDF. In der echten App rendert Gotenberg Inhalt, Kopf- und Fußzeile.', 'warn')}>PDF</Button>
        </div>
      </div>
      {tab === 'preview' ? (
        <>
          {result.error && <p className="rounded-[3px] bg-danger-soft px-3 py-2 text-xs whitespace-pre-line text-danger">Das Template enthält einen Fehler: {result.error}</p>}
          {template && <PagedPreview result={result} paper={template.manifest.paper} showGuides={guides} onPageCount={setPages} />}
        </>
      ) : (
        <div className="rounded-[3px] border border-line bg-sheet shadow-sheet">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
            <p className="text-xs text-muted">Vereinfachte Vorschau der eingebetteten XML (ZUGFeRD, EN 16931).</p>
            <Button size="sm" variant="ghost" icon={<Copy size={14} />} onClick={() => navigator.clipboard?.writeText(xml).then(() => toast('XML kopiert.'))}>Kopieren</Button>
          </div>
          <pre className="max-h-[70vh] overflow-auto p-4 font-mono text-[11px] leading-relaxed text-muted">{xml}</pre>
        </div>
      )}
    </div>
  )
}
