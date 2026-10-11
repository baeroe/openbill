import { describe, expect, it } from 'vitest';
import { isThemePref, resolveTheme } from './theme';

describe('resolveTheme', () => {
    it('follows the system only for "system"', () => {
        expect(resolveTheme('system', true)).toBe('dark');
        expect(resolveTheme('system', false)).toBe('light');
        expect(resolveTheme('light', true)).toBe('light');
        expect(resolveTheme('dark', false)).toBe('dark');
    });
});

describe('isThemePref', () => {
    it('accepts the three preferences only', () => {
        expect(['system', 'light', 'dark'].every(isThemePref)).toBe(true);
        expect(isThemePref('blue')).toBe(false);
        expect(isThemePref(null)).toBe(false);
    });
});
