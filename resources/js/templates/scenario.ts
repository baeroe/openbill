import type { RenderSources } from '@/api/templates';
import type { DocumentType } from '@/api/types';

/** Sample scenario of a gallery thumbnail: an invoice, unless the template is made for quotes only. */
export function previewScenario(types: DocumentType[]): 'short_invoice' | 'offer_with_options' {
    return types.includes('offer') && !types.includes('invoice') && !types.includes('confirmation') && !types.includes('cancellation')
        ? 'offer_with_options'
        : 'short_invoice';
}

export type SampleSource = { kind: 'scenario'; key: string } | { kind: 'document'; id: string };

export const sourceValue = (source: SampleSource): string => (source.kind === 'scenario' ? `scenario:${source.key}` : `document:${source.id}`);

export function parseSource(value: string): SampleSource | null {
    const [kind, ...rest] = value.split(':');
    const id = rest.join(':');
    if (!id) return null;
    if (kind === 'scenario') return { kind, key: id };
    if (kind === 'document') return { kind, id };
    return null;
}

/** The most recently edited document (sources come newest first), without documents the long sample invoice. */
export function defaultSource(sources: RenderSources): SampleSource {
    const [latest] = sources.documents;
    return latest ? { kind: 'document', id: latest.id } : { kind: 'scenario', key: 'long_invoice' };
}
