import { useEffect } from 'react'
import { PagedPreview, type Zone } from '@/components/PagedPreview'
import { Skeleton } from '@/components/ui'
import type { TemplateContextInput } from '@/domain/templateContext'
import type { Template } from '@/domain/types'
import { useRenderedDocument } from '@/hooks/useRenderedDocument'

/** Gerenderte Seiten eines Templates mit einem Beispieldokument. */
export function TemplatePreview({ template, input, maxPages, highlight, showGuides, onPageCount, onError, title }: {
  template: Template
  input: TemplateContextInput | null
  maxPages?: number
  highlight?: Zone | null
  showGuides?: boolean
  onPageCount?(n: number): void
  onError?(e: string | null): void
  title?: string
}) {
  const { result } = useRenderedDocument(input, template)
  useEffect(() => { onError?.(result.error) }, [result.error]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!input || !result.body) return <Skeleton h="100%" r={4} className="tpl-preview-skeleton" />
  return <PagedPreview result={result} paper={template.manifest.paper} maxPages={maxPages} highlight={highlight} showGuides={showGuides} onPageCount={onPageCount} title={title} />
}
