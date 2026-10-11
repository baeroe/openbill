import { describe, expect, it } from 'vitest'
import { computePageBreaks, pageGeometry, toPx } from './paper'

describe('toPx', () => {
  it('converts print units at 96 dpi', () => {
    expect(toPx('25.4mm')).toBeCloseTo(96)
    expect(toPx('1in')).toBe(96)
    expect(toPx('10px')).toBe(10)
    expect(toPx('')).toBe(0)
  })
})

describe('pageGeometry', () => {
  it('derives the content area from header, footer and side margins', () => {
    const g = pageGeometry({ format: 'A4', marginX: '20mm', headerHeight: '25mm', footerHeight: '20mm' })
    expect(Math.round(g.width)).toBe(794)
    expect(Math.round(g.contentHeight)).toBe(Math.round(toPx('252mm')))
    expect(Math.round(g.contentWidth)).toBe(Math.round(toPx('170mm')))
  })
})

describe('computePageBreaks', () => {
  it('fits everything on one page', () => {
    expect(computePageBreaks([{ top: 0, bottom: 100 }], 100, 500)).toEqual([0])
  })
  it('never splits a block: breaks before the block that crosses the page edge', () => {
    const blocks = [{ top: 0, bottom: 300 }, { top: 300, bottom: 450 }, { top: 450, bottom: 600 }]
    expect(computePageBreaks(blocks, 600, 500)).toEqual([0, 450])
  })
  it('cuts a block taller than a page instead of looping forever', () => {
    expect(computePageBreaks([{ top: 0, bottom: 1200 }], 1200, 500)).toEqual([0, 500, 1000])
  })
})
