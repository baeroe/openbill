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
        expect(keys.taxRates()).toBe('/api/tax-rates?include_archived=1');
        expect(keys.units()).toBe('/api/units?include_archived=1');
        expect(keys.textBlocks()).toBe('/api/text-blocks');
        expect(keys.customerChoices()).toBe('/api/customers?itemsPerPage=100');
        expect(keys.suggestions(' Work ')).toBe('/api/position-suggestions?q=Work&limit=6');
        expect(keys.suggestions('')).toBeNull();
        expect(keys.documentXml('01k9')).toBe('/api/documents/01k9/xml');
        expect(keys.documentPdf('01k9')).toBe('/api/documents/01k9/pdf?inline=1');
    });

    it('know the template and settings URLs', () => {
        expect(keys.templates()).toBe('/api/templates');
        expect(keys.template('01k9')).toBe('/api/templates/01k9');
        expect(keys.renderSources()).toBe('/api/render/sources?limit=50');
        expect(keys.renderSchema()).toBe('/api/render/schema');
        expect(keys.documentTypes()).toBe('/api/document-types');
        expect(keys.allFieldDefinitions()).toBe('/api/field-definitions');
        expect(keys.organization()).toBe('/api/organization');
        expect(keys.users()).toBe('/api/users');
    });

    it('builds the number preview URL', () => {
        expect(keys.numberPreview('invoice', 'INV-{YYYY}-{0000}', true, 7)).toBe('/api/document-types/invoice/number-preview?pattern=INV-%7BYYYY%7D-%7B0000%7D&reset_yearly=1&next_value=7');
        expect(keys.numberPreview('offer', 'Q-{0000}', false, null)).toBe('/api/document-types/offer/number-preview?pattern=Q-%7B0000%7D&reset_yearly=0');
    });
});
