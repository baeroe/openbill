import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { computePageBreaks, pageGeometry, type Paper } from './geometry';
import './paged-preview.css';

/** The three standalone HTML documents of POST /api/render. */
export type RenderedParts = { header: string; body: string; footer: string };

export type Zone = 'header' | 'body' | 'footer';

export type PagedPreviewLabels = {
    document: string;
    page(n: number): string;
    header: string;
    body: string;
    footer: string;
};

export const DEFAULT_LABELS: PagedPreviewLabels = {
    document: 'Document preview',
    page: (n) => `Page ${n}`,
    header: 'Header',
    body: 'Content',
    footer: 'Footer',
};

export type PagedPreviewProps = {
    parts: RenderedParts;
    paper: Paper;
    showGuides?: boolean;
    highlight?: Zone | null;
    maxPages?: number;
    maxHeight?: number;
    onPageCount?(count: number): void;
    className?: string;
    labels?: Partial<PagedPreviewLabels>;
};

/** Elements never split across pages (what Chromium tries for rows and paragraphs). */
const ATOMIC = 'tr, p, li, h1, h2, h3, h4, h5, h6, dt, dd, img, pre, blockquote, figure, section.address, .keep';
/** Gap between two pages in unscaled pixels. */
export const PAGE_GAP = 28;
/** Room for the zone labels left of the pages when guides are shown. */
const GUTTER = 24;

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

/*
 * Security: every frame is sandbox="allow-same-origin" WITHOUT allow-scripts. Same origin is needed to measure the body
 * and fill in page numbers from outside; without script rights nothing in the rendered markup can run. Never add
 * allow-scripts here – together with allow-same-origin a frame could lift its own sandbox.
 * Cost: n pages make 3n+1 frames, all reloaded on every render answer. Fine for the editor; when the template editor
 * (phase 7) or the toolkit (phase 9) show long documents, fill frames outside the viewport only once visible
 * (IntersectionObserver).
 */

/** Fills {{ page.number }} / {{ page.total }} (rendered as .pageNumber / .totalPages) of one header or footer frame. */
function fillPageNumbers(frame: HTMLIFrameElement | null, page: number, total: number): void {
    const doc = frame?.contentDocument;
    if (!doc) return;
    doc.querySelectorAll('.pageNumber').forEach((element) => (element.textContent = String(page)));
    doc.querySelectorAll('.totalPages').forEach((element) => (element.textContent = String(total)));
}

function Band({ html, top, width, height, page, total, title }: { html: string; top: number; width: number; height: number; page: number; total: number; title: string }) {
    const ref = useRef<HTMLIFrameElement>(null);
    useEffect(() => fillPageNumbers(ref.current, page, total), [page, total, html]);
    return (
        <iframe
            ref={ref}
            title={title}
            sandbox="allow-same-origin"
            srcDoc={html}
            onLoad={() => fillPageNumbers(ref.current, page, total)}
            className="pp-frame"
            style={{ top, width, height }}
            tabIndex={-1}
        />
    );
}

/**
 * Pages as in the finished PDF: the header in the top margin and the footer in the bottom margin of every page,
 * the body cut into pages in between. All frames run without script rights; the markup is rendered on the server.
 */
export function PagedPreview({ parts, paper, showGuides = false, highlight = null, maxPages, maxHeight, onPageCount, className, labels }: PagedPreviewProps): JSX.Element {
    const text = { ...DEFAULT_LABELS, ...labels };
    // the render answer is a new object every time: only real changes of the paper count
    const g = useMemo(() => pageGeometry(paper), [paper.format, paper.marginX, paper.headerHeight, paper.footerHeight]); // eslint-disable-line react-hooks/exhaustive-deps
    const box = useRef<HTMLDivElement>(null);
    const measure = useRef<HTMLIFrameElement>(null);
    const pageCountRef = useRef(onPageCount);
    const [boxWidth, setBoxWidth] = useState(400);
    const [layout, setLayout] = useState<{ breaks: number[]; total: number }>({ breaks: [0], total: g.contentHeight });

    useEffect(() => {
        pageCountRef.current = onPageCount;
    }, [onPageCount]);

    useEffect(() => {
        const element = box.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const paginate = useCallback(() => {
        const doc = measure.current?.contentDocument;
        if (!doc?.body) return;
        const scroll = doc.documentElement.scrollTop;
        const total = Math.max(doc.documentElement.scrollHeight, 1);
        const blocks = [...doc.querySelectorAll(ATOMIC)].map((element) => {
            const rect = element.getBoundingClientRect();
            return { top: rect.top + scroll, bottom: rect.bottom + scroll };
        });
        const breaks = computePageBreaks(blocks, total, g.contentHeight);
        setLayout({ breaks, total });
        pageCountRef.current?.(breaks.length);
    }, [g.contentHeight]);

    useEffect(paginate, [paginate, g.contentWidth]);

    const withGuides = showGuides || !!highlight;
    const gutter = withGuides ? GUTTER : 0;
    const scale = Math.max(0.1, (boxWidth - gutter) / g.width);
    const pageCount = layout.breaks.length;
    const pages = layout.breaks.slice(0, maxPages ?? pageCount);
    const stackHeight = pages.length * g.height + (pages.length - 1) * PAGE_GAP;
    const visible = maxHeight ? Math.min(stackHeight * scale, maxHeight) : stackHeight * scale;
    const zones: { zone: Zone; label: string; y: number; h: number; x: number; w: number }[] = [
        { zone: 'header', label: text.header, y: 0, h: g.headerHeight, x: 0, w: g.width },
        { zone: 'body', label: text.body, y: g.headerHeight, h: g.contentHeight, x: g.marginX, w: g.contentWidth },
        { zone: 'footer', label: text.footer, y: g.height - g.footerHeight, h: g.footerHeight, x: 0, w: g.width },
    ];
    const shown = zones.filter((z) => showGuides || highlight === z.zone);

    return (
        <div ref={box} className={cx('pp', className)} style={{ height: visible }} role="img" aria-label={text.document}>
            <iframe
                ref={measure}
                title={text.document}
                aria-hidden
                sandbox="allow-same-origin"
                srcDoc={parts.body}
                onLoad={paginate}
                className="pp-measure"
                style={{ width: g.contentWidth, height: 10 }}
                tabIndex={-1}
            />

            <div className="pp-stack" style={{ left: gutter, width: g.width, transform: `scale(${scale})` }}>
                {pages.map((start, i) => {
                    const end = layout.breaks[i + 1] ?? layout.total;
                    return (
                        <div key={i} data-page={i + 1} className="pp-page" style={{ top: i * (g.height + PAGE_GAP), width: g.width, height: g.height }}>
                            <Band html={parts.header} top={0} width={g.width} height={g.headerHeight} page={i + 1} total={pageCount} title={text.header} />
                            <div className="pp-clip" style={{ top: g.headerHeight, left: g.marginX, width: g.contentWidth, height: end - start }}>
                                <iframe
                                    title={i === 0 ? text.document : text.page(i + 1)}
                                    sandbox="allow-same-origin"
                                    srcDoc={parts.body}
                                    className="pp-frame"
                                    style={{ top: -start, width: g.contentWidth, height: layout.total }}
                                    tabIndex={-1}
                                />
                            </div>
                            <Band html={parts.footer} top={g.height - g.footerHeight} width={g.width} height={g.footerHeight} page={i + 1} total={pageCount} title={text.footer} />
                            {shown.map((z) => (
                                <div key={z.zone} className={cx('pp-guide', highlight === z.zone && 'pp-guide--on')} style={{ top: z.y, left: z.x, width: z.w, height: z.h }} />
                            ))}
                        </div>
                    );
                })}
            </div>

            {pages.map((_, i) =>
                shown.map((z) => (
                    <span
                        key={`${i}-${z.zone}`}
                        className={cx('pp-label', highlight === z.zone && 'pp-label--on')}
                        style={{ top: (i * (g.height + PAGE_GAP) + z.y) * scale + 1, height: Math.max(z.h * scale - 2, 8) }}
                    >
                        {z.zone === 'body' && i > 0 ? `${z.label}, ${text.page(i + 1)}` : z.label}
                    </span>
                )),
            )}
        </div>
    );
}
