import { describe, expect, it } from 'vitest';
import { sameDecimal } from './decimal';
import { syncCell } from './decimal-cell-state';

const invalid = { raw: 'abc', invalid: true };
const sync = { value: '1', previous: '1', disabled: false, focused: false, minFraction: 0 };

describe('sameDecimal', () => {
    it('compares spellings of the same number without calculating', () => {
        expect(sameDecimal('1', '1.0000')).toBe(true);
        expect(sameDecimal('-0.50', '-0.5')).toBe(true);
        expect(sameDecimal('0.0000', '-0')).toBe(true);
        expect(sameDecimal('010', '10')).toBe(true);
        expect(sameDecimal('1', '1.5')).toBe(false);
        expect(sameDecimal('-1', '1')).toBe(false);
    });
});

describe('syncCell', () => {
    it('keeps invalid input when the stored value only changes its spelling (save answer "1.0000")', () => {
        expect(syncCell(invalid, { ...sync, value: '1.0000' })).toBe(invalid);
    });

    it('shows a really changed stored value instead of old invalid input', () => {
        expect(syncCell(invalid, { ...sync, value: '2.0000' })).toEqual({ raw: '2', invalid: false });
    });

    it('always shows the stored value in a disabled field (finalized elsewhere)', () => {
        expect(syncCell(invalid, { ...sync, value: '1.0000', disabled: true })).toEqual({ raw: '1', invalid: false });
    });

    it('leaves a focused field alone and formats an untouched one', () => {
        const typing = { raw: '12,', invalid: false };
        expect(syncCell(typing, { ...sync, value: '3', focused: true })).toBe(typing);
        expect(syncCell({ raw: '1', invalid: false }, { ...sync, value: '450.0000', minFraction: 2 })).toEqual({ raw: '450.00', invalid: false });
    });
});
