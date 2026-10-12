import { apiUrl } from '@/lib/api';
import type { DocumentFilters, DocumentType, FieldScope } from './types';

/** Rows per page of the paginated lists (the API allows up to 100). */
export const PAGE_SIZE = 50;

/**
 * SWR keys are the request URLs. The default fetcher (lib/swr.tsx) loads them as JSON; paginated lists
 * pass apiPage as fetcher (api/paged.ts).
 */
export const keys = {
    customers: (q: string, page: number) => apiUrl('/api/customers', { q: q.trim(), page, itemsPerPage: PAGE_SIZE }),
    customerOptions: (q: string) => apiUrl('/api/customers', { q: q.trim(), itemsPerPage: 20 }),
    customer: (id: string) => `/api/customers/${id}`,
    documents: (filters: DocumentFilters, page: number) =>
        apiUrl('/api/documents', {
            type: filters.type,
            status: filters.status,
            customer_id: filters.customer_id,
            q: filters.q?.trim(),
            page,
            itemsPerPage: PAGE_SIZE,
        }),
    document: (id: string) => `/api/documents/${id}`,
    allFieldDefinitions: () => '/api/field-definitions',
    fieldDefinitions: (scope: FieldScope) => apiUrl('/api/field-definitions', { scope }),
    // archived rates and units stay readable in old drafts and finalized documents; pickers offer only active ones
    taxRates: () => apiUrl('/api/tax-rates', { include_archived: true }),
    units: () => apiUrl('/api/units', { include_archived: true }),
    textBlocks: () => '/api/text-blocks',
    /** Customer select of the editor: the first 100 by name. */
    customerChoices: () => apiUrl('/api/customers', { itemsPerPage: 100 }),
    /** Suggestions for a typed title; null (nothing to fetch) while the title is empty. */
    suggestions: (q: string) => (q.trim() ? apiUrl('/api/position-suggestions', { q: q.trim(), limit: 6 }) : null),
    documentXml: (id: string) => `/api/documents/${id}/xml`,
    documentPdf: (id: string) => `/api/documents/${id}/pdf?inline=1`,
    templates: () => '/api/templates',
    template: (id: string) => `/api/templates/${id}`,
    renderSources: () => apiUrl('/api/render/sources', { limit: 50 }),
    renderSchema: () => '/api/render/schema',
    documentTypes: () => '/api/document-types',
    organization: () => '/api/organization',
    numberPreview: (type: DocumentType, pattern: string, resetYearly: boolean, nextValue: number | null) =>
        apiUrl(`/api/document-types/${type}/number-preview`, { pattern, reset_yearly: resetYearly ? 1 : 0, next_value: nextValue }),
};
