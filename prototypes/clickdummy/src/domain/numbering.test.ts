import { describe, expect, it } from 'vitest'
import { allocateNumber } from './numbering'

const d = (iso: string) => new Date(`${iso}T00:00:00`)

describe('allocateNumber', () => {
  it('keeps separate counters per year when backdating', () => {
    const state = { pattern: 'RE-{YYYY}-{0000}', nextSeq: 5, resetYearly: true, lastYear: 2026, yearSeqs: { '2025': 8 } }
    const back = allocateNumber(state, d('2025-12-30'))
    expect(back.number).toBe('RE-2025-0008')
    const next = allocateNumber(back.next, d('2026-10-04'))
    expect(next.number).toBe('RE-2026-0005')
  })
  it('starts a fresh year at 1 and never moves lastYear backwards', () => {
    const r = allocateNumber({ pattern: '{YYYY}-{000}', nextSeq: 42, resetYearly: true, lastYear: 2026 }, d('2025-06-01'))
    expect(r.number).toBe('2025-001')
    expect(r.next.lastYear).toBe(2026)
    expect(allocateNumber(r.next, d('2026-01-02')).number).toBe('2026-042')
  })
  it('uses one running counter without yearly reset', () => {
    const r = allocateNumber({ pattern: 'RE-{0000}', nextSeq: 7, resetYearly: false, lastYear: 2026 }, d('2025-01-01'))
    expect(r.number).toBe('RE-0007')
    expect(r.next.nextSeq).toBe(8)
  })
})
