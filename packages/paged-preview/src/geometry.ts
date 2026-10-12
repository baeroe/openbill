/** Paper of a template manifest, as POST /api/render returns it ("20mm", "1in", …). */
export type Paper = { format: 'A4' | 'Letter' | (string & {}); marginX: string; headerHeight: string; footerHeight: string };

export type PageGeometry = {
    width: number;
    height: number;
    marginX: number;
    headerHeight: number;
    footerHeight: number;
    contentWidth: number;
    contentHeight: number;
};

export type Block = { top: number; bottom: number };

const UNIT = { mm: 96 / 25.4, cm: 96 / 2.54, in: 96, pt: 96 / 72, px: 1 } as const;

/** Same formats as App\Rendering\Paper::FORMATS. */
const FORMATS: Record<string, { width: string; height: string }> = {
    A4: { width: '210mm', height: '297mm' },
    Letter: { width: '8.5in', height: '11in' },
};

/** CSS length in pixels at 96 dpi (as Chromium prints). Supports mm, cm, in, pt, px; anything else is 0. */
export function toPx(value: string): number {
    const match = /^\s*(-?\d+(?:\.\d+)?)\s*(mm|cm|in|pt|px)?\s*$/.exec(value ?? '');
    if (!match) return 0;
    return Number(match[1]) * UNIT[(match[2] ?? 'px') as keyof typeof UNIT];
}

/**
 * Page layout like Gotenberg/Chromium: the header sits in the top margin, the footer in the bottom margin,
 * the body flows in between. Header and footer heights are the page margins.
 */
export function pageGeometry(paper: Paper): PageGeometry {
    const format = FORMATS[paper.format] ?? FORMATS.A4;
    const width = toPx(format.width);
    const height = toPx(format.height);
    const marginX = toPx(paper.marginX);
    const headerHeight = toPx(paper.headerHeight);
    const footerHeight = toPx(paper.footerHeight);

    return {
        width,
        height,
        marginX,
        headerHeight,
        footerHeight,
        contentWidth: width - 2 * marginX,
        contentHeight: Math.max(1, height - headerHeight - footerHeight),
    };
}

/**
 * Page breaks for the preview: a block (table row, paragraph, …) that crosses the page edge moves to the next
 * page as a whole; a block taller than a page is cut. Returns the start offset of every page in pixels.
 */
export function computePageBreaks(blocks: Block[], totalHeight: number, pageContentHeight: number): number[] {
    const breaks = [0];
    let start = 0;
    while (start + pageContentHeight < totalHeight) {
        const limit = start + pageContentHeight;
        const crossing = blocks.filter((block) => block.top > start && block.top < limit && block.bottom > limit);
        const next = crossing.length ? Math.min(...crossing.map((block) => block.top)) : limit;
        breaks.push(next);
        start = next;
    }
    return breaks;
}
