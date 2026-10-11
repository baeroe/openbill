import { getLocale } from '@/lib/i18n';

/** Intl locale of a UI language (English with day-month order, as in the rest of Europe). */
export function intlLocale(locale: string = getLocale()): string {
    return locale === 'de' ? 'de-DE' : 'en-GB';
}

/**
 * Amount string of the API ("1130.50", "-119.00") as money. Intl.NumberFormat formats decimal strings
 * exactly (ES2023), so the amount never becomes a float. openbill has one currency (spec 13).
 */
export function formatMoney(amount: string, locale?: string): string {
    const format = new Intl.NumberFormat(intlLocale(locale), { style: 'currency', currency: 'EUR' }).format as unknown as (value: string) => string;
    return format(amount);
}

const atNoon = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);

export function formatDate(iso: string | null | undefined, locale?: string): string {
    if (!iso) return '';
    return new Intl.DateTimeFormat(intlLocale(locale), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(atNoon(iso));
}

/** "2026-03" → "March 2026" / "März 2026". */
export function formatMonth(key: string, locale?: string): string {
    return new Intl.DateTimeFormat(intlLocale(locale), { month: 'long', year: 'numeric' }).format(atNoon(`${key}-01`));
}

export function formatLongDate(date: Date, locale?: string): string {
    return new Intl.DateTimeFormat(intlLocale(locale), { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}

export function monthName(date: Date, locale?: string): string {
    return new Intl.DateTimeFormat(intlLocale(locale), { month: 'long' }).format(date);
}

/** Whole days from one ISO date to another (calendar days, DST-safe). */
export function daysBetween(fromIso: string, toIso: string): number {
    const utc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
    return Math.round((utc(toIso) - utc(fromIso)) / 86_400_000);
}

/** "today", "tomorrow", "3 days ago", "in 3 days" in the UI language. */
export function relativeDays(iso: string, today: string, locale?: string): string {
    return new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' }).format(daysBetween(today, iso), 'day');
}

/** Today in the browser's time zone as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Rows grouped by the month of their date, newest month first; the order inside a month stays. */
export function groupByMonth<T extends { date: string }>(rows: T[]): { key: string; items: T[] }[] {
    const groups = new Map<string, T[]>();
    for (const row of rows) {
        const key = row.date.slice(0, 7);
        groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return [...groups.entries()].map(([key, items]) => ({ key, items })).sort((a, b) => b.key.localeCompare(a.key));
}

/** Two letters for an avatar; legal forms like GmbH or e. V. don't count. */
export function initials(name: string): string {
    const words = name
        .replace(/\b(GmbH|AG|AB|KG|UG|Ltd|Inc|e\.\s?V\.)(?=\s|$)/gi, '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    return (
        words
            .slice(0, 2)
            .map((word) => word[0]?.toUpperCase() ?? '')
            .join('') || '?'
    );
}

export function countryName(code: string, locale?: string): string {
    if (!code) return '';
    try {
        return new Intl.DisplayNames([intlLocale(locale)], { type: 'region' }).of(code.toUpperCase()) ?? code;
    } catch {
        return code;
    }
}

/**
 * Typed number → API string with a dot ("12,50" → "12.50", "1.234,5" → "1234.5"). Empty → null.
 * Anything else stays as typed, so the server answers with a message for that field.
 */
export function toDecimalString(raw: string): string | null {
    const value = raw.trim().replace(/\s/g, '');
    if (value === '') return null;
    return value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value;
}
