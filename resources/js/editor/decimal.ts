import { intlLocale } from '@/lib/format';

const DECIMAL = /^-?\d+(?:\.\d+)?$/;

/**
 * Normalizes separators of a typed number: the last of "," and "." is the decimal separator, the other one groups.
 * "1.234,50" → "1234.50", "1,234.50" → "1234.50", "12,5" → "12.5". Spaces (also narrow ones) are dropped.
 */
function normalize(raw: string): string {
    const value = raw.trim().replace(/[\s  ']/g, '');
    const comma = value.lastIndexOf(',');
    const dot = value.lastIndexOf('.');
    if (comma >= 0 && dot >= 0) return comma > dot ? value.replace(/\./g, '').replace(',', '.') : value.replace(/,/g, '');
    if (comma >= 0 && value.indexOf(',') === comma) return value.replace(',', '.');
    return value;
}

/**
 * A typed quantity or price as the API takes it (string with a dot, at most `scale` decimals).
 * Empty counts as 0; anything else the API would refuse is 'invalid' and is not sent.
 * Only the format is checked here – nothing is calculated.
 */
export function parseDecimalInput(raw: string, scale = 4): string | 'invalid' {
    const value = normalize(raw);
    if (value === '') return '0';
    if (!DECIMAL.test(value)) return 'invalid';
    return (value.split('.')[1] ?? '').length > scale ? 'invalid' : value;
}

/** An API decimal string for an input field in the UI language: no grouping (typing it back stays unambiguous). */
export function formatDecimalInput(value: string, locale?: string, minFraction = 0): string {
    if (!DECIMAL.test(value)) return value;
    const format = new Intl.NumberFormat(intlLocale(locale), { useGrouping: false, minimumFractionDigits: minFraction, maximumFractionDigits: 4 })
        .format as unknown as (v: string) => string;
    return format(value);
}

/** "0", "0.00", "-0.0000" – a format check of an API string (optional sums, removed rows), no arithmetic. */
export function isZeroDecimal(value: string): boolean {
    return DECIMAL.test(value) && /^-?0+(\.0+)?$/.test(value);
}
