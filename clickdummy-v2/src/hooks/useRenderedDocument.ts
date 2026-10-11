import { useEffect, useMemo, useState } from 'react'
import { createLiquid, renderDocument, type RenderResult } from '@/domain/liquid'
import { buildTemplateContext, type TemplateContextInput } from '@/domain/templateContext'
import type { Template } from '@/domain/types'

const engine = createLiquid()
const EMPTY: RenderResult = { body: '', header: '', footer: '', error: null }

/** Rendert Inhalt, Kopf- und Fußzeile mit Liquid, leicht verzögert, damit Tippen flüssig bleibt. */
export function useRenderedDocument(input: TemplateContextInput | null, template: Template | null, delay = 120) {
  const ctx = useMemo(() => (input ? buildTemplateContext(input) : null), [input])
  const [result, setResult] = useState<RenderResult>(EMPTY)
  useEffect(() => {
    if (!ctx || !template) return
    let cancelled = false
    const t = setTimeout(() => {
      renderDocument(engine, template, ctx).then((r) => !cancelled && setResult(r))
    }, delay)
    return () => { cancelled = true; clearTimeout(t) }
  }, [ctx, template, delay])
  return { result, ctx }
}
