import { describe, expect, it } from 'vitest';
import { formatDecimalInput, isZeroDecimal, parseDecimalInput } from './decimal';

describe('parseDecimalInput', () => {
    it('turns typed numbers into API strings with a dot', () => {
        expect(parseDecimalInput('12,5')).toBe('12.5');
        expect(parseDecimalInput('12.5')).toBe('12.5');
        expect(parseDecimalInput('1.234,50')).toBe('1234.50');
        expect(parseDecimalInput('1,234.50')).toBe('1234.50');
        expect(parseDecimalInput('1 234,5')).toBe('1234.5');
        expect(parseDecimalInput('-2')).toBe('-2');
        expect(parseDecimalInput(' 3 ')).toBe('3');
    });

    it('reads an empty field as 0', () => {
        expect(parseDecimalInput('')).toBe('0');
        expect(parseDecimalInput('   ')).toBe('0');
    });

    it('refuses what the API would refuse', () => {
        expect(parseDecimalInput('abc')).toBe('invalid');
        expect(parseDecimalInput('1e3')).toBe('invalid');
        expect(parseDecimalInput('1,2,3')).toBe('invalid');
        expect(parseDecimalInput('1.23456')).toBe('invalid');
        expect(parseDecimalInput('1.234567', 6)).toBe('1.234567');
        expect(parseDecimalInput('--1')).toBe('invalid');
    });
});

describe('formatDecimalInput', () => {
    it('shows API strings in the UI language without grouping or trailing zeros', () => {
        expect(formatDecimalInput('2.0000', 'en')).toBe('2');
        expect(formatDecimalInput('1234.5', 'de')).toBe('1234,5');
        expect(formatDecimalInput('1234.5', 'en')).toBe('1234.5');
        expect(formatDecimalInput('-1.5', 'de')).toBe('-1,5');
    });

    it('keeps two decimals for prices when asked', () => {
        expect(formatDecimalInput('450.0000', 'de', 2)).toBe('450,00');
        expect(formatDecimalInput('0.125', 'en', 2)).toBe('0.125');
    });

    it('leaves anything that is not a decimal string as it is', () => {
        expect(formatDecimalInput('abc', 'en')).toBe('abc');
    });
});

describe('isZeroDecimal', () => {
    it('recognizes zero in every spelling of the API', () => {
        expect(isZeroDecimal('0.00')).toBe(true);
        expect(isZeroDecimal('-0.0000')).toBe(true);
        expect(isZeroDecimal('0')).toBe(true);
        expect(isZeroDecimal('0.01')).toBe(false);
        expect(isZeroDecimal('10')).toBe(false);
    });
});
