import { describe, expect, it } from 'vitest'
import { mergeOrSeed } from './persistence'

describe('mergeOrSeed', () => {
  const current = { documents: [{ id: 'a' }], x: 1 }
  const valid = (s: Record<string, unknown>) => Array.isArray(s.documents)
  it('uses persisted state when it has the right shape', () => {
    expect(mergeOrSeed(valid)({ documents: [] }, current)).toEqual({ documents: [], x: 1 })
  })
  it('falls back to the current (seed) state for broken data', () => {
    expect(mergeOrSeed(valid)({ documents: null }, current)).toBe(current)
    expect(mergeOrSeed(valid)('garbage', current)).toBe(current)
    expect(mergeOrSeed(valid)(undefined, current)).toBe(current)
  })
})
