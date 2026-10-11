import type { TemplateManifest } from './types'

/** CSS-Länge in Pixel bei 96 dpi (wie Chromium beim Drucken). Unterstützt mm, cm, in, pt, px. */
export function toPx(value: string): number {
  const m = /^\s*(-?[\d.]+)\s*(mm|cm|in|pt|px)?\s*$/.exec(value ?? '')
  if (!m) return 0
  const n = parseFloat(m[1])
  const factor = { mm: 96 / 25.4, cm: 96 / 2.54, in: 96, pt: 96 / 72, px: 1 }[(m[2] ?? 'px') as 'mm']
  return n * factor
}

const FORMATS = { A4: { w: '210mm', h: '297mm' }, Letter: { w: '8.5in', h: '11in' } } as const

export interface PageGeometry {
  width: number
  height: number
  marginX: number
  headerHeight: number
  footerHeight: number
  contentWidth: number
  contentHeight: number
}

/**
 * Seitenaufbau wie bei Gotenberg/Chromium: Kopfzeile im oberen Rand, Fußzeile im unteren,
 * dazwischen der Inhalt. Die Höhen von Kopf- und Fußzeile sind die Seitenränder.
 */
export function pageGeometry(paper: TemplateManifest['paper']): PageGeometry {
  const f = FORMATS[paper.format] ?? FORMATS.A4
  const width = toPx(f.w)
  const height = toPx(f.h)
  const marginX = toPx(paper.marginX)
  const headerHeight = toPx(paper.headerHeight)
  const footerHeight = toPx(paper.footerHeight)
  return { width, height, marginX, headerHeight, footerHeight, contentWidth: width - 2 * marginX, contentHeight: Math.max(1, height - headerHeight - footerHeight) }
}

export interface Block { top: number; bottom: number }

/**
 * Seitenumbrüche für die Vorschau: Ein Block (Tabellenzeile, Absatz …), der über die Seitenkante ragt,
 * wandert komplett auf die nächste Seite. Blöcke, die höher als eine Seite sind, werden geschnitten.
 * Liefert die Startposition jeder Seite in Pixel.
 */
export function computePageBreaks(blocks: Block[], totalHeight: number, pageContentHeight: number): number[] {
  const breaks = [0]
  let start = 0
  while (start + pageContentHeight < totalHeight) {
    const limit = start + pageContentHeight
    const crossing = blocks.filter((b) => b.top > start && b.top < limit && b.bottom > limit)
    const next = crossing.length ? Math.min(...crossing.map((b) => b.top)) : limit
    breaks.push(next)
    start = next
  }
  return breaks
}
