import { describe, expect, it } from 'vitest'
import { createLiquid, renderDocument } from './liquid'
import type { TemplateContext } from './templateContext'
import type { TemplateManifest } from './types'

const manifest: TemplateManifest = {
  name: 'T', version: '1.0.0', author: 'a', license: 'MIT', description: '', documentTypes: ['invoice'], expectedFields: [],
  paper: { format: 'A4', marginX: '20mm', headerHeight: '25mm', footerHeight: '20mm' },
}
const ctx: TemplateContext = {
  org: { name: 'Studio <Nordlicht>' }, customer: null, contact: { first_name: 'Ida' },
  document: { number: 'RE-1', date: '2026-10-04', gross_total: 1234.5, intro: 'Hallo {{ contact.first_name }}', closing: 'Zeile 1\nZeile 2' },
  positions: [], groups: [],
}
const norm = (s: string) => s.replace(/\s/g, ' ')
const tpl = (liquid: string, extra: { header?: string; footer?: string } = {}) => ({ manifest, css: '', liquid, header: extra.header ?? '', footer: extra.footer ?? '' })

describe('renderDocument', () => {
  const engine = createLiquid()

  it('renders values with custom filters and escapes output', async () => {
    const r = await renderDocument(engine, tpl('{{ document.date | date }}|{{ document.gross_total | money }}|{{ org.name }}'), ctx)
    expect(r.error).toBeNull()
    expect(norm(r.body)).toContain('04.10.2026|1.234,50 €|Studio &lt;Nordlicht&gt;')
  })

  it('renders liquid inside intro and nl2br in closing', async () => {
    const r = await renderDocument(engine, tpl('{{ document.intro | nl2br }}#{{ document.closing | nl2br }}'), ctx)
    expect(r.body).toContain('Hallo Ida#Zeile 1<br>Zeile 2')
  })

  it('returns an error page instead of throwing on broken syntax', async () => {
    const r = await renderDocument(engine, tpl('{% for p in positions %}{{ p.title }'), ctx)
    expect(r.error).not.toBeNull()
    expect(r.body).toContain('Template-Fehler')
  })

  it('renders header and footer as separate documents with page placeholders for Chromium', async () => {
    const r = await renderDocument(engine, tpl('Inhalt', {
      header: '<b>{{ document.number }}</b>',
      footer: 'Seite {{ page.number }} von {{page.total}}',
    }), ctx)
    expect(r.header).toContain('<b>RE-1</b>')
    expect(r.header).not.toContain('Inhalt')
    expect(r.footer).toContain('Seite <span class="pageNumber"></span> von <span class="totalPages"></span>')
    expect(r.body).not.toContain('pageNumber')
  })

  it('reports errors in the footer', async () => {
    const r = await renderDocument(engine, tpl('ok', { footer: '{% if %}' }), ctx)
    expect(r.error).toMatch(/Fußzeile/)
  })
})

describe('escaping of pre-rendered texts', () => {
  const engine = createLiquid()
  it('escapes customer data in the intro exactly once', async () => {
    const c: TemplateContext = { ...ctx, customer: { name: 'Müller & Söhne' }, document: { ...ctx.document, intro: 'Für {{ customer.name }}', closing: '' } }
    const viaNl2br = await renderDocument(engine, tpl('{{ document.intro | nl2br }}'), c)
    const plain = await renderDocument(engine, tpl('{{ document.intro }}'), c)
    expect(viaNl2br.body).toContain('Für Müller &amp; Söhne')
    expect(plain.body).toContain('Für Müller &amp; Söhne')
    expect(viaNl2br.body).not.toContain('&amp;amp;')
  })
})
