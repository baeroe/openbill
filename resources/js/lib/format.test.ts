import { describe, expect, it } from 'vitest';
import {
    countryName,
    daysBetween,
    formatDate,
    formatLongDate,
    formatMoney,
    formatMonth,
    groupByMonth,
    initials,
    relativeDays,
    toDecimalString,
    todayIso,
} from './format';

// Intl puts a no-break space between amount and currency in German
const plain = (text: string) => text.replace(/[  ]/g, ' ');

describe('formatMoney', () => {
    it('formats amount strings in the UI language', () => {
        expect(plain(formatMoney('1234.5', 'de'))).toBe('1.234,50 €');
        expect(formatMoney('1234.5', 'en')).toBe('€1,234.50');
    });

    it('keeps negative amounts of cancellations', () => {
        expect(plain(formatMoney('-119.00', 'de'))).toBe('-119,00 €');
    });

    it('is exact beyond the precision of floats', () => {
        // as a float this would be 9007199254740992
        expect(formatMoney('9007199254740993.10', 'en')).toBe('€9,007,199,254,740,993.10');
    });
});

describe('dates', () => {
    it('formats ISO dates without shifting the day', () => {
        expect(formatDate('2026-10-11', 'de')).toBe('11.10.2026');
        expect(formatDate('2026-10-11', 'en')).toBe('11/10/2026');
        expect(formatDate(null, 'de')).toBe('');
    });

    it('names months and long dates', () => {
        expect(formatMonth('2026-03', 'de')).toBe('März 2026');
        expect(formatMonth('2026-03', 'en')).toBe('March 2026');
        expect(formatLongDate(new Date(2026, 9, 11), 'de')).toBe('Sonntag, 11. Oktober');
    });

    it('counts days and says them relative to today', () => {
        expect(daysBetween('2026-10-11', '2026-10-14')).toBe(3);
        expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2); // across the DST change
        expect(relativeDays('2026-10-11', '2026-10-11', 'de')).toBe('heute');
        expect(relativeDays('2026-10-12', '2026-10-11', 'de')).toBe('morgen');
        expect(relativeDays('2026-10-08', '2026-10-11', 'de')).toBe('vor 3 Tagen');
        expect(relativeDays('2026-10-14', '2026-10-11', 'en')).toBe('in 3 days');
    });

    it('gives today as local ISO date', () => {
        expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    });
});

describe('groupByMonth', () => {
    it('groups by month, newest first, keeping the order inside a month', () => {
        const rows = [
            { id: 'a', date: '2026-10-02' },
            { id: 'b', date: '2026-09-30' },
            { id: 'c', date: '2026-10-20' },
        ];

        expect(groupByMonth(rows)).toEqual([
            { key: '2026-10', items: [rows[0], rows[2]] },
            { key: '2026-09', items: [rows[1]] },
        ]);
        expect(groupByMonth([])).toEqual([]);
    });
});

describe('names', () => {
    it('builds initials without legal forms', () => {
        expect(initials('Hafenkontor Lindqvist GmbH')).toBe('HL');
        expect(initials('Kulturwerk Elbinsel e. V.')).toBe('KE');
        expect(initials('Fjord Analytics AB')).toBe('FA');
        expect(initials('   ')).toBe('?');
    });

    it('names countries in the UI language', () => {
        expect(countryName('SE', 'de')).toBe('Schweden');
        expect(countryName('se', 'en')).toBe('Sweden');
        expect(countryName('', 'de')).toBe('');
    });
});

describe('toDecimalString', () => {
    it('turns typed numbers into API strings with a dot', () => {
        expect(toDecimalString('12,50')).toBe('12.50');
        expect(toDecimalString('1.234,5')).toBe('1234.5');
        expect(toDecimalString(' 12.5 ')).toBe('12.5');
        expect(toDecimalString('-3')).toBe('-3');
        expect(toDecimalString('')).toBeNull();
        expect(toDecimalString('abc')).toBe('abc'); // left for the server to refuse with a message
    });
});
