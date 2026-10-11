import { describe, expect, it } from 'vitest';
import { keys, PAGE_SIZE } from './keys';

describe('keys', () => {
    it('are the request URLs, with empty filters left out', () => {
        expect(keys.documents({ type: 'invoice', status: 'overdue', q: '  ' }, 2)).toBe(`/api/documents?type=invoice&status=overdue&page=2&itemsPerPage=${PAGE_SIZE}`);
        expect(keys.documents({}, 1)).toBe('/api/documents?page=1&itemsPerPage=50');
        expect(keys.customers(' Fjord ', 1)).toBe('/api/customers?q=Fjord&page=1&itemsPerPage=50');
        expect(keys.customerOptions('')).toBe('/api/customers?itemsPerPage=20');
        expect(keys.customer('01k9')).toBe('/api/customers/01k9');
        expect(keys.document('01k9')).toBe('/api/documents/01k9');
        expect(keys.fieldDefinitions('contact')).toBe('/api/field-definitions?scope=contact');
    });
});
