import { describe, expect, it } from 'vitest';
import { documentLabel, errorLabel, newer, pagesLabel, parseSource, sourceValue } from './describe';

describe('sources', () => {
    it('round-trips select values', () => {
        expect(sourceValue({ kind: 'scenario', key: 'long_invoice', locale: 'de' })).toBe('scenario:long_invoice');
        expect(parseSource('scenario:long_invoice', 'de')).toEqual({ kind: 'scenario', key: 'long_invoice', locale: 'de' });
        expect(parseSource('document:01kdoc', 'en')).toEqual({ kind: 'document', id: '01kdoc' });
        expect(parseSource('document:', 'en')).toBeNull();
        expect(parseSource('other:x', 'en')).toBeNull();
    });

    it('labels documents with number and customer, drafts with their type', () => {
        const base = { id: '01k', type: 'invoice', status: 'draft', date: '2026-10-12', locale: 'de' };
        expect(documentLabel({ ...base, number: 'INV-2026-0007', customer_name: 'Hafenkontor Lindqvist' })).toBe('INV-2026-0007 · Hafenkontor Lindqvist');
        expect(documentLabel({ ...base, number: null, customer_name: null })).toBe('Draft invoice');
    });
});

describe('errors and events', () => {
    it('labels errors with file and line', () => {
        expect(errorLabel({ part: 'body', file: 'template.liquid', line: 12, message: 'x' })).toBe('template.liquid:12');
        expect(errorLabel({ part: 'intro', file: null, line: null, message: 'x' })).toBe('intro');
    });

    it('keeps the newer event', () => {
        expect(newer(null, { seq: 1 })).toEqual({ seq: 1 });
        expect(newer({ seq: 3 }, { seq: 2 })).toEqual({ seq: 3 });
        expect(newer({ seq: 3 }, { seq: 4 })).toEqual({ seq: 4 });
    });

    it('counts pages', () => {
        expect(pagesLabel(1)).toBe('1 page');
        expect(pagesLabel(3)).toBe('3 pages');
    });
});
