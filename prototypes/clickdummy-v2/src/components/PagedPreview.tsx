import { useEffect, useMemo, useRef, useState } from 'react'
import type { RenderResult } from '@/domain/liquid'
import { computePageBreaks, pageGeometry } from '@/domain/paper'
import type { TemplateManifest } from '@/domain/types'
import { cx } from './ui'
import './PagedPreview.css'

export type Zone = 'header' | 'body' | 'footer'

/** Elemente, die beim Umbruch nicht geteilt werden (wie Chromium es für Zeilen und Absätze versucht). */
const ATOMIC = 'tr, p, li, h1, h2, h3, h4, h5, h6, dt, dd, img, pre, blockquote, figure, section.address, .keep'
const PAGE_GAP = 28
const GUTTER = 24

const mm = (px: number) => `${Math.round(px / (96 / 25.4))} mm`

function fillPageNumbers(frame: HTMLIFrameElement | null, page: number, total: number) {
  const doc = frame?.contentDocument
  if (!doc) return
  doc.querySelectorAll('.pageNumber').forEach((el) => { el.textContent = String(page) })
  doc.querySelectorAll('.totalPages').forEach((el) => { el.textContent = String(total) })
}

function Band({ html, top, width, height, page, total }: { html: string; top: number; width: number; height: number; page: number; total: number }) {
  const ref = useRef<HTMLIFrameElement>(null)
  useEffect(() => fillPageNumbers(ref.current, page, total), [page, total, html])
  return (
    <iframe ref={ref} title={`Seitenbereich ${top === 0 ? 'oben' : 'unten'}`} sandbox="allow-same-origin" srcDoc={html}
      onLoad={() => fillPageNumbers(ref.current, page, total)} className="pp-frame" style={{ top, width, height }} tabIndex={-1} />
  )
}

/**
 * Seitenweise Vorschau wie im fertigen PDF: Kopfzeile im oberen, Fußzeile im unteren Rand jeder Seite,
 * dazwischen der umbrochene Inhalt. Iframes ohne Script-Rechte.
 */
export function PagedPreview({ result, paper, showGuides = false, highlight = null, maxPages, maxHeight, onPageCount, className, title = 'Dokumentvorschau' }: {
  result: RenderResult
  paper: TemplateManifest['paper']
  showGuides?: boolean
  highlight?: Zone | null
  maxPages?: number
  maxHeight?: number
  onPageCount?(n: number): void
  className?: string
  title?: string
}) {
  const g = useMemo(() => pageGeometry(paper), [paper])
  const box = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLIFrameElement>(null)
  const [boxWidth, setBoxWidth] = useState(400)
  const [layout, setLayout] = useState<{ breaks: number[]; total: number }>({ breaks: [0], total: g.contentHeight })

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const paginate = () => {
    const doc = measure.current?.contentDocument
    if (!doc?.body) return
    const total = Math.max(doc.documentElement.scrollHeight, 1)
    const blocks = [...doc.querySelectorAll(ATOMIC)].map((el) => {
      const r = el.getBoundingClientRect()
      return { top: r.top + doc.documentElement.scrollTop, bottom: r.bottom + doc.documentElement.scrollTop }
    })
    const breaks = computePageBreaks(blocks, total, g.contentHeight)
    setLayout({ breaks, total })
    onPageCount?.(breaks.length)
  }
  useEffect(paginate, [g.contentHeight, g.contentWidth]) // eslint-disable-line react-hooks/exhaustive-deps

  const withGuides = showGuides || !!highlight
  const gutter = withGuides ? GUTTER : 0
  const scale = Math.max(0.1, (boxWidth - gutter) / g.width)
  const pageCount = layout.breaks.length
  const pages = layout.breaks.slice(0, maxPages ?? pageCount)
  const stackHeight = pages.length * g.height + (pages.length - 1) * PAGE_GAP
  const visible = maxHeight ? Math.min(stackHeight * scale, maxHeight) : stackHeight * scale

  return (
    <div ref={box} className={cx('pp', className)} style={{ height: visible }} aria-label={title} role="img">
      <iframe ref={measure} title="Messung" aria-hidden sandbox="allow-same-origin" srcDoc={result.body} onLoad={paginate}
        className="pp-measure" style={{ width: g.contentWidth, height: 10 }} tabIndex={-1} />

      <div className="pp-stack" style={{ left: gutter, width: g.width, transform: `scale(${scale})` }}>
        {pages.map((start, i) => {
          const end = layout.breaks[i + 1] ?? layout.total
          const top = i * (g.height + PAGE_GAP)
          return (
            <div key={i} data-page={i + 1} className="pp-page" style={{ top, width: g.width, height: g.height }}>
              <Band html={result.header} top={0} width={g.width} height={g.headerHeight} page={i + 1} total={pageCount} />
              <div className="pp-clip" style={{ top: g.headerHeight, left: g.marginX, width: g.contentWidth, height: end - start }}>
                <iframe title={i === 0 ? title : `${title}, Seite ${i + 1}`} sandbox="allow-same-origin" srcDoc={result.body}
                  className="pp-frame" style={{ top: -start, width: g.contentWidth, height: layout.total }} tabIndex={-1} />
              </div>
              <Band html={result.footer} top={g.height - g.footerHeight} width={g.width} height={g.footerHeight} page={i + 1} total={pageCount} />
              {withGuides && (
                <>
                  {(showGuides || highlight === 'header') && <div className={cx('pp-guide', highlight === 'header' && 'pp-guide--on')} style={{ top: 0, left: 0, width: g.width, height: g.headerHeight }} />}
                  {(showGuides || highlight === 'body') && <div className={cx('pp-guide', highlight === 'body' && 'pp-guide--on')} style={{ top: g.headerHeight, left: g.marginX, width: g.contentWidth, height: g.contentHeight }} />}
                  {(showGuides || highlight === 'footer') && <div className={cx('pp-guide', highlight === 'footer' && 'pp-guide--on')} style={{ top: g.height - g.footerHeight, left: 0, width: g.width, height: g.footerHeight }} />}
                </>
              )}
            </div>
          )
        })}
      </div>

      {withGuides && pages.map((_, i) => {
        const top = i * (g.height + PAGE_GAP) * scale
        const zones: { zone: Zone; label: string; title: string; y: number; h: number }[] = [
          { zone: 'header', label: 'Kopfzeile', title: `Kopfzeile, ${mm(g.headerHeight)} hoch, auf jeder Seite`, y: 0, h: g.headerHeight },
          { zone: 'body', label: i === 0 ? 'Inhalt' : `Inhalt, Seite ${i + 1}`, title: 'Inhalt, fließt über so viele Seiten wie nötig', y: g.headerHeight, h: g.contentHeight },
          { zone: 'footer', label: 'Fußzeile', title: `Fußzeile, ${mm(g.footerHeight)} hoch, auf jeder Seite`, y: g.height - g.footerHeight, h: g.footerHeight },
        ]
        return zones
          .filter((z) => showGuides || highlight === z.zone)
          .map((z) => (
            <span key={`${i}-${z.zone}`} title={z.title} className={cx('pp-label', highlight === z.zone && 'pp-label--on')}
              style={{ top: top + z.y * scale + 1, height: Math.max(z.h * scale - 2, 8) }}>{z.label}</span>
          ))
      })}
    </div>
  )
}
