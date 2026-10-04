import { Liquid } from 'liquidjs'
import { formatDate, formatDecimal, formatMoney } from './format'
import type { TemplateContext } from './templateContext'
import type { Template } from './types'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function createLiquid(): Liquid {
  const engine = new Liquid({ outputEscape: 'escape', strictVariables: false, strictFilters: true, ownPropertyOnly: true })
  engine.registerFilter('money', (v: unknown) => formatMoney(Number(v ?? 0)))
  engine.registerFilter('date', (v: unknown) => formatDate(v ? String(v) : null))
  engine.registerFilter('number', (v: unknown, decimals = 2) => formatDecimal(Number(v ?? 0), Number(decimals)))
  engine.registerFilter('nl2br', { handler: (v: unknown) => escapeHtml(String(v ?? '')).replace(/\n/g, '<br>'), raw: true })
  return engine
}

const PAPER = { A4: { w: '210mm', h: '297mm' }, Letter: { w: '216mm', h: '279mm' } } as const

const shell = (body: string, css: string, manifest: Template['manifest']) => {
  const p = PAPER[manifest.paper.format] ?? PAPER.A4
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>
html{background:#fff}
body{margin:0;box-sizing:border-box;width:${p.w};min-height:${p.h};padding:${manifest.paper.margin};}
@media print{@page{size:${manifest.paper.format};margin:${manifest.paper.margin}}body{width:auto;min-height:0;padding:0}}
${css}
</style></head><body>${body}</body></html>`
}

export interface RenderResult { html: string; error: string | null }

/** Rendert ein Dokument. Wirft nie: Fehler landen als lesbare Fehlerseite in `html`. */
export async function renderDocument(
  engine: Liquid,
  template: Pick<Template, 'liquid' | 'css' | 'manifest'>,
  ctx: TemplateContext,
): Promise<RenderResult> {
  try {
    const intro = await engine.parseAndRender(String(ctx.document.intro ?? ''), ctx)
    const closing = await engine.parseAndRender(String(ctx.document.closing ?? ''), ctx)
    const body = await engine.parseAndRender(template.liquid, { ...ctx, document: { ...ctx.document, intro, closing } })
    return { html: shell(body, template.css, template.manifest), error: null }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const body = `<div style="font:14px/1.5 system-ui;color:#b42318"><strong>Template-Fehler</strong><pre style="white-space:pre-wrap">${escapeHtml(message)}</pre></div>`
    return { html: shell(body, '', template.manifest), error: message }
  }
}

/** Rendert einen einzelnen Text (z. B. Textbaustein) mit Liquid; Fehler werden als Text zurückgegeben. */
export async function renderText(engine: Liquid, text: string, ctx: TemplateContext): Promise<string> {
  try {
    return await engine.parseAndRender(text, ctx)
  } catch (e) {
    return `⚠ ${e instanceof Error ? e.message : String(e)}`
  }
}
