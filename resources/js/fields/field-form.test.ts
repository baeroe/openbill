import { describe, expect, it } from 'vitest';
import { emptyDefinition, hasDocTypes, moveId, slugKey, toggleDocType } from './field-form';

describe('slugKey', () => {
    it('builds keys like App\\Domain\\Fields\\KeySlugger', () => {
        expect(slugKey('Größe der Fläche')).toBe('groesse_der_flaeche');
        expect(slugKey('Bestellnummer des Kunden')).toBe('bestellnummer_des_kunden');
        expect(slugKey('Café Crème')).toBe('cafe_creme');
        expect(slugKey('  2. Ansprechpartner ')).toBe('f_2_ansprechpartner');
        expect(slugKey('!!!')).toBe('');
    });
});

describe('toggleDocType', () => {
    it('adds in the canonical order and refuses to remove the last type (review focus)', () => {
        expect(toggleDocType(['invoice'], 'offer')).toEqual(['offer', 'invoice']);
        expect(toggleDocType(['offer', 'invoice'], 'offer')).toEqual(['invoice']);
        expect(toggleDocType(['invoice'], 'invoice')).toBeNull();
    });
});

describe('moveId', () => {
    it('moves one id up or down and keeps the list at the edges', () => {
        expect(moveId(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
        expect(moveId(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
        expect(moveId(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    });
});

describe('emptyDefinition', () => {
    it('applies document and position fields to every type, other levels to none', () => {
        expect(emptyDefinition('document').doc_types).toEqual(['offer', 'confirmation', 'invoice', 'cancellation']);
        expect(emptyDefinition('customer').doc_types).toEqual([]);
        expect([hasDocTypes('position'), hasDocTypes('org')]).toEqual([true, false]);
    });
});
