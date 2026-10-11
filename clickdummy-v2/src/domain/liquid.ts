import { Liquid } from 'liquidjs'
import { formatDate, formatDecimal, formatMoney } from './format'
import type { TemplateContext } from './templateContext'
import { pageGeometry } from './paper'
import type { Template } from './types'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function createLiquid({ escape = true }: { escape?: boolean } = {}): Liquid {
  const engine = new Liquid({ outputEscape: escape ? 'escape' : undefined, strictVariables: false, strictFilters: true, ownPropertyOnly: true })
  engine.registerFilter('money', (v: unknown) => formatMoney(Number(v ?? 0)))
  engine.registerFilter('date', (v: unknown) => formatDate(v ? String(v) : null))
  engine.registerFilter('number', (v: unknown, decimals = 2) => formatDecimal(Number(v ?? 0), Number(decimals)))
  engine.registerFilter('nl2br', { handler: (v: unknown) => escapeHtml(String(v ?? '')).replace(/\n/g, '<br>'), raw: true })
  return engine
}

const DOC_HEAD = '<!doctype html><html lang="de"><head><meta charset="utf-8">'

/** Inhalt: so breit wie der Inhaltsbereich der Seite, ohne eigene Ränder (die setzt Gotenberg). */
const bodyShell = (body: string, css: string, paper: Template['manifest']['paper']) => {
  const g = pageGeometry(paper)
  return `${DOC_HEAD}<style>
html{background:#fff}
body{margin:0;width:${g.contentWidth}px}
@media print{@page{size:${paper.format};margin:${paper.headerHeight} ${paper.marginX} ${paper.footerHeight}}body{width:auto}}
${css}
</style></head><body>${body}</body></html>`
}

/** Kopf-/Fußzeile: eigener Kontext wie bei Chromium, ohne das CSS des Inhalts. */
const bandShell = (body: string, width: number, height: number) =>
  `${DOC_HEAD}<style>html{-webkit-print-color-adjust:exact;background:#fff}body{margin:0;width:${width}px;height:${height}px;overflow:hidden}</style></head><body>${body}</body></html>`

/** {{ page.number }} / {{ page.total }} werden zu den Klassen, die Chromium beim Drucken befüllt. */
const PAGE_TOKENS: [RegExp, string][] = [
  [/\{\{\s*page\.number\s*\}\}/g, '<span class="pageNumber"></span>'],
  [/\{\{\s*page\.total\s*\}\}/g, '<span class="totalPages"></span>'],
]
const withPageTokens = (src: string) => PAGE_TOKENS.reduce((s, [re, html]) => s.replace(re, html), src)

const errorBody = (where: string, message: string) =>
  `<div style="font:14px/1.5 system-ui;color:#b42318;padding:12px"><strong>Template-Fehler (${where})</strong><pre style="white-space:pre-wrap">${escapeHtml(message)}</pre></div>`

/** Kopf-/Fußtexte werden ohne Escaping vorgerendert; escaped wird genau einmal bei der Ausgabe im Template. */
let textEngine: Liquid | null = null
const getTextEngine = () => (textEngine ??= createLiquid({ escape: false }))

export interface RenderResult {
  body: string
  header: string
  footer: string
  error: string | null
}

type RenderableTemplate = Pick<Template, 'liquid' | 'css' | 'manifest' | 'header' | 'footer'>

/** Rendert Inhalt, Kopf- und Fußzeile als drei eigene HTML-Dokumente (wie Gotenberg sie bekommt). Wirft nie. */
export async function renderDocument(engine: Liquid, template: RenderableTemplate, ctx: TemplateContext): Promise<RenderResult> {
  const g = pageGeometry(template.manifest.paper)
  const errors: string[] = []
  const part = async (where: string, src: string, data: object) => {
    try {
      return await engine.parseAndRender(withPageTokens(src), data)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      errors.push(`${where}: ${message}`)
      return errorBody(where, message)
    }
  }
  let full: object = ctx
  try {
    const intro = await getTextEngine().parseAndRender(String(ctx.document.intro ?? ''), ctx)
    const closing = await getTextEngine().parseAndRender(String(ctx.document.closing ?? ''), ctx)
    full = { ...ctx, document: { ...ctx.document, intro, closing } }
  } catch (e) {
    errors.push(`Einleitung/Schlusstext: ${e instanceof Error ? e.message : String(e)}`)
  }
  const body = await part('Inhalt', template.liquid, full)
  const header = await part('Kopfzeile', template.header ?? '', full)
  const footer = await part('Fußzeile', template.footer ?? '', full)
  return {
    body: bodyShell(body, template.css, template.manifest.paper),
    header: bandShell(header, g.width, g.headerHeight),
    footer: bandShell(footer, g.width, g.footerHeight),
    error: errors.length ? errors.join('\n') : null,
  }
}

/** Rendert einen einzelnen Text (z. B. Textbaustein) mit Liquid; Fehler werden als Text zurückgegeben. */
export async function renderText(text: string, ctx: TemplateContext): Promise<string> {
  try {
    return await getTextEngine().parseAndRender(text, ctx)
  } catch (e) {
    return `⚠ ${e instanceof Error ? e.message : String(e)}`
  }
}
