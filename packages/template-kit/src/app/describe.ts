import type { RenderErrorItem, RenderSources, Source } from '../shared/protocol';

export const SCENARIO_LABELS: Record<string, string> = {
    short_invoice: 'Short invoice',
    long_invoice: 'Long invoice (several pages)',
    small_business: 'Small business (no VAT)',
    reverse_charge: 'Reverse charge (EU)',
    offer_with_options: 'Quote with optional items',
};

export const sourceValue = (source: Source): string => (source.kind === 'scenario' ? `scenario:${source.key}` : `document:${source.id}`);

export function parseSource(value: string, locale: 'en' | 'de'): Source | null {
    const [kind, ...rest] = value.split(':');
    const id = rest.join(':');
    if (id === '') return null;
    if (kind === 'scenario') return { kind, key: id, locale };
    if (kind === 'document') return { kind, id };
    return null;
}

export function documentLabel(document: RenderSources['documents'][number]): string {
    const number = document.number ?? `Draft ${document.type}`;
    return document.customer_name ? `${number} · ${document.customer_name}` : number;
}

/** "template.liquid:12", or the part when there is no file (intro/closing of a document). */
export function errorLabel(error: RenderErrorItem): string {
    const where = error.file ?? error.part;
    return error.line ? `${where}:${error.line}` : where;
}

/** Newest render wins: an event never replaces one with a higher sequence number. */
export function newer<T extends { seq: number }>(current: T | null, next: T): T {
    return current !== null && current.seq > next.seq ? current : next;
}

export const pagesLabel = (n: number): string => (n === 1 ? '1 page' : `${n} pages`);
