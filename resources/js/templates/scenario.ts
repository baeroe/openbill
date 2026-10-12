import type { DocumentType } from '@/api/types';

/** Sample scenario of a gallery thumbnail: an invoice, unless the template is made for quotes only. */
export function previewScenario(types: DocumentType[]): 'short_invoice' | 'offer_with_options' {
    return types.includes('offer') && !types.includes('invoice') && !types.includes('confirmation') && !types.includes('cancellation')
        ? 'offer_with_options'
        : 'short_invoice';
}
