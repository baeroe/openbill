import useSWR from 'swr';
import { api } from '@/lib/api';
import { keys } from './keys';
import { usePagedList, type PagedList } from './paged';
import type { DocumentFilters, DocumentSummary, DocumentType } from './types';

export function useDocumentList(filters: DocumentFilters): PagedList<DocumentSummary> {
    return usePagedList<DocumentSummary>((page) => keys.documents(filters, page));
}

/** Item form of a document; phase 6 adds the full type (groups, totals, issues). */
export function useDocument(id: string) {
    return useSWR<DocumentSummary>(keys.document(id));
}

export function createDocument(input: { type: DocumentType; customer_id: string | null }): Promise<DocumentSummary> {
    return api<DocumentSummary>('/api/documents', { method: 'POST', body: input });
}
