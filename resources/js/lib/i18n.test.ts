import { describe, expect, it } from 'vitest';
import { localeHref } from './i18n';

describe('localeHref', () => {
    it('swaps the language prefix and keeps path and query', () => {
        expect(localeHref('de', { pathname: '/en/documents', search: '?type=invoice' })).toBe('/de/documents?type=invoice');
        expect(localeHref('en', { pathname: '/de', search: '' })).toBe('/en');
        expect(localeHref('de', { pathname: '/en/customers/01k9', search: '' })).toBe('/de/customers/01k9');
    });
});
