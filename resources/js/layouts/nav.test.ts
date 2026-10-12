import { describe, expect, it } from 'vitest';
import { isActive, navItems, setupItems } from './nav';

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

    it('lists the main pages and the setup group', () => {
        expect(navItems().map((item) => item.href)).toEqual(['/en', '/en/documents', '/en/customers', '/en/templates']);
        expect(setupItems().map((item) => item.href)).toEqual(['/en/fields', '/en/settings']);
    });

    it('keeps settings active on every section', () => {
        const [, settings] = setupItems();

        expect(isActive('/en/settings/taxes-units', settings)).toBe(true);
        expect(isActive('/en/settings', settings)).toBe(true);
    });
});
