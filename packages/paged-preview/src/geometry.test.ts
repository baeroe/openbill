import { describe, expect, it } from 'vitest';
import { computePageBreaks, pageGeometry, toPx } from './geometry';

describe('toPx', () => {
    it('converts print units at 96 dpi', () => {
        expect(toPx('25.4mm')).toBeCloseTo(96);
        expect(toPx('2.54cm')).toBeCloseTo(96);
        expect(toPx('1in')).toBe(96);
        expect(toPx('72pt')).toBeCloseTo(96);
        expect(toPx('10px')).toBe(10);
        expect(toPx(' 10 ')).toBe(10);
    });

    it('treats anything else as 0', () => {
        expect(toPx('')).toBe(0);
        expect(toPx('20 furlongs')).toBe(0);
        expect(toPx('calc(1mm + 2mm)')).toBe(0);
    });
});

describe('pageGeometry', () => {
    it('derives the content area from header, footer and side margins', () => {
        const g = pageGeometry({ format: 'A4', marginX: '20mm', headerHeight: '25mm', footerHeight: '20mm' });

        expect(Math.round(g.width)).toBe(794);
        expect(Math.round(g.height)).toBe(1123);
        expect(Math.round(g.contentHeight)).toBe(Math.round(toPx('252mm')));
        expect(Math.round(g.contentWidth)).toBe(Math.round(toPx('170mm')));
    });

    it('knows Letter and falls back to A4 for unknown formats', () => {
        expect(pageGeometry({ format: 'Letter', marginX: '1in', headerHeight: '1in', footerHeight: '1in' }).width).toBe(816);
        expect(Math.round(pageGeometry({ format: 'A3', marginX: '0mm', headerHeight: '0mm', footerHeight: '0mm' }).width)).toBe(794);
    });

    it('never returns a content height below one pixel', () => {
        expect(pageGeometry({ format: 'A4', marginX: '0mm', headerHeight: '200mm', footerHeight: '200mm' }).contentHeight).toBe(1);
    });
});

describe('computePageBreaks', () => {
    it('fits everything on one page', () => {
        expect(computePageBreaks([{ top: 0, bottom: 100 }], 100, 500)).toEqual([0]);
        expect(computePageBreaks([], 0, 500)).toEqual([0]);
    });

    it('never splits a block: breaks before the block that crosses the page edge', () => {
        const blocks = [{ top: 0, bottom: 300 }, { top: 300, bottom: 450 }, { top: 450, bottom: 600 }];

        expect(computePageBreaks(blocks, 600, 500)).toEqual([0, 450]);
    });

    it('breaks at the edge when a block ends exactly there', () => {
        expect(computePageBreaks([{ top: 0, bottom: 500 }, { top: 500, bottom: 600 }], 600, 500)).toEqual([0, 500]);
    });

    it('moves the earliest crossing block (nested rows inside a section)', () => {
        expect(computePageBreaks([{ top: 100, bottom: 900 }, { top: 450, bottom: 550 }], 900, 500)).toEqual([0, 100, 600]);
    });

    it('cuts a block taller than a page instead of looping forever', () => {
        expect(computePageBreaks([{ top: 0, bottom: 1200 }], 1200, 500)).toEqual([0, 500, 1000]);
    });
});
