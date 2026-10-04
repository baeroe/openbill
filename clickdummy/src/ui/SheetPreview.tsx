import { useEffect, useRef, useState } from 'react'
import { cx } from './cx'

const PAGE_WIDTH = 794 // 210mm bei 96 dpi

/** Zeigt gerendertes HTML als skaliertes A4-Blatt. Das iframe hat keine Script-Rechte. */
export function SheetPreview({ html, className, title = 'Dokumentvorschau', maxHeight }: { html: string; className?: string; title?: string; maxHeight?: number }) {
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [scale, setScale] = useState(0.5)
  const [height, setHeight] = useState(1123)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / PAGE_WIDTH))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const measure = () => {
    const doc = frame.current?.contentDocument
    if (doc?.body) setHeight(Math.max(1123, doc.documentElement.scrollHeight))
  }

  const visible = maxHeight ? Math.min(height * scale, maxHeight) : height * scale
  return (
    <div ref={box} className={cx('relative w-full overflow-hidden bg-white shadow-sheet ring-1 ring-line', className)} style={{ height: visible }}>
      <iframe
        ref={frame}
        title={title}
        sandbox="allow-same-origin"
        srcDoc={html}
        onLoad={measure}
        className="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
        style={{ width: PAGE_WIDTH, height, transform: `scale(${scale})` }}
      />
    </div>
  )
}
