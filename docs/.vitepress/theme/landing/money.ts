// Exact euro arithmetic for the hero invoice: amounts are integer cents, never floats (like the app).

/** "760.00" or "95" → 76000 / 9500 cents. */
export function toCents(amount: string): number {
    const [whole, fraction = ''] = amount.trim().split('.');
    return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
}

/** Line amount for an integer quantity (the demo invoice has no fractional quantities). */
export function lineCents(quantity: string, price: string): number {
    return Number(quantity) * toCents(price);
}

/** Percentage of an amount, rounded half up to the cent. */
export function percentOf(cents: number, rate: number): number {
    return Math.floor((cents * rate + 50) / 100);
}

/** Formats cents as euros; the amount goes to Intl as a decimal string so nothing is rounded twice. */
export function formatCents(cents: number, locale: string): string {
    const whole = Math.trunc(cents / 100);
    const fraction = String(Math.abs(cents % 100)).padStart(2, '0');
    const format = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format as (value: string) => string;
    return format(`${whole}.${fraction}`);
}
