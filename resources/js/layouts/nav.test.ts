import { describe, expect, it } from 'vitest';
import { isActive, navItems } from './nav';

describe('isActive', () => {
    it('matches the overview exactly and sections with their sub pages', () => {
        const [overview, documents] = navItems();

        expect(isActive('/en', overview)).toBe(true);
        expect(isActive('/en?from=login', overview)).toBe(true);
        expect(isActive('/en/documents', overview)).toBe(false);
        expect(isActive('/en/documents?type=invoice', documents)).toBe(true);
        expect(isActive('/en/documents/01k9', documents)).toBe(true);
        expect(isActive('/en/documents-archive', documents)).toBe(false);
    });

    it('lists only pages that exist in this phase', () => {
        expect(navItems().map((item) => item.href)).toEqual(['/en', '/en/documents', '/en/customers']);
    });
});
