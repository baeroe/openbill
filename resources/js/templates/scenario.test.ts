import { describe, expect, it } from 'vitest';
import { defaultSource, parseSource, previewScenario, sourceValue } from './scenario';

describe('previewScenario', () => {
    it('shows an invoice when the template can do invoices, else a quote', () => {
        expect(previewScenario(['offer', 'confirmation', 'invoice', 'cancellation'])).toBe('short_invoice');
        expect(previewScenario(['offer'])).toBe('offer_with_options');
        expect(previewScenario(['confirmation'])).toBe('short_invoice');
        expect(previewScenario([])).toBe('short_invoice');
    });
});

describe('sample sources', () => {
    const sources = {
        scenarios: [
            { key: 'short_invoice', document_type: 'invoice' as const },
            { key: 'long_invoice', document_type: 'invoice' as const },
        ],
        documents: [{ id: '01k9', type: 'invoice' as const, status: 'draft' as const, number: null, date: '2026-10-12', customer_name: 'Hafenkontor Lindqvist GmbH', locale: 'de' }],
    };

    it('round-trips the select value', () => {
        expect(parseSource(sourceValue({ kind: 'scenario', key: 'long_invoice' }))).toEqual({ kind: 'scenario', key: 'long_invoice' });
        expect(parseSource(sourceValue({ kind: 'document', id: '01k9' }))).toEqual({ kind: 'document', id: '01k9' });
        expect(parseSource('nonsense')).toBeNull();
    });

    it('starts with the most recently edited document, else the long invoice', () => {
        expect(defaultSource(sources)).toEqual({ kind: 'document', id: '01k9' });
        expect(defaultSource({ ...sources, documents: [] })).toEqual({ kind: 'scenario', key: 'long_invoice' });
    });
});
