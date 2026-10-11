import { apiUrl } from '@/lib/api';
import type { DocumentFilters, FieldScope } from './types';

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
    fieldDefinitions: (scope: FieldScope) => apiUrl('/api/field-definitions', { scope }),
};
