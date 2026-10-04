import { describe, expect, it } from 'vitest'
import { createLiquid, renderDocument } from './liquid'
import type { TemplateContext } from './templateContext'
import type { TemplateManifest } from './types'

const manifest: TemplateManifest = {
  name: 'T', version: '1.0.0', author: 'a', license: 'MIT', description: '', documentTypes: ['invoice'], expectedFields: [],
  paper: { format: 'A4', margin: '20mm' },
}
const ctx: TemplateContext = {
  org: { name: 'Studio <Nordlicht>' }, customer: null, contact: { first_name: 'Ida' },
  document: { number: 'RE-1', date: '2026-10-04', gross_total: 1234.5, intro: 'Hallo {{ contact.first_name }}', closing: 'Zeile 1\nZeile 2' },
  positions: [], groups: [],
}
const norm = (s: string) => s.replace(/\s/g, ' ')

describe('renderDocument', () => {
  const engine = createLiquid()

  it('renders values with custom filters and escapes output', async () => {
    const r = await renderDocument(engine, { manifest, css: '', liquid: '{{ document.date | date }}|{{ document.gross_total | money }}|{{ org.name }}' }, ctx)
    expect(r.error).toBeNull()
    expect(norm(r.html)).toContain('04.10.2026|1.234,50 €|Studio &lt;Nordlicht&gt;')
  })

  it('renders liquid inside intro and nl2br in closing', async () => {
    const r = await renderDocument(engine, { manifest, css: '', liquid: '{{ document.intro | nl2br }}#{{ document.closing | nl2br }}' }, ctx)
    expect(r.html).toContain('Hallo Ida#Zeile 1<br>Zeile 2')
  })

  it('returns an error page instead of throwing on broken syntax', async () => {
    const r = await renderDocument(engine, { manifest, css: '', liquid: '{% for p in positions %}{{ p.title }' }, ctx)
    expect(r.error).not.toBeNull()
    expect(r.html).toContain('Template-Fehler')
  })
})
