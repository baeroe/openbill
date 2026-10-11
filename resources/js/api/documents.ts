import useSWR from 'swr';
import { api, apiText } from '@/lib/api';
import type { DraftPayload } from '@/editor/types';
import { keys } from './keys';
import { invalidate, usePagedList, type PagedList } from './paged';
import type { DocumentDetail, DocumentFilters, DocumentStatus, DocumentSummary, DocumentType, RenderResponse } from './types';

export function useDocumentList(filters: DocumentFilters): PagedList<DocumentSummary> {
    return usePagedList<DocumentSummary>((page) => keys.documents(filters, page));
}

/** Item form with groups, totals and (drafts) compliance issues. */
export function useDocument(id: string) {
    return useSWR<DocumentDetail>(keys.document(id));
}

export async function createDocument(input: { type: DocumentType; customer_id: string | null }): Promise<DocumentSummary> {
    const document = await api<DocumentSummary>('/api/documents', { method: 'POST', body: input });
    void invalidate('/api/documents');
    return document;
}

/** Autosave target. The answer carries the server ids of new groups and positions (same order as sent). */
export function saveDraft(id: string, payload: DraftPayload, options: { keepalive?: boolean } = {}): Promise<DocumentDetail> {
    return api<DocumentDetail>(keys.document(id), { method: 'PATCH', body: payload, keepalive: options.keepalive });
}

export type RenderRequest = { document_id: string; draft?: DraftPayload };

/** Rendered parts, totals and issues of the saved document, with the unsaved draft on top when given. */
export function renderPreview(body: RenderRequest, signal?: AbortSignal): Promise<RenderResponse> {
    return api<RenderResponse>('/api/render', { method: 'POST', body, signal });
}

/** After an action: the document's cache gets the answer, lists and other details reload. */
async function settle(document: DocumentDetail): Promise<DocumentDetail> {
    void invalidate('/api/documents', [keys.document(document.id)]);
    return document;
}

const action = (id: string, name: string, body?: unknown) => api<DocumentDetail>(`${keys.document(id)}/${name}`, { method: 'POST', body: body ?? {} });

export const finalizeDocument = async (id: string) => settle(await action(id, 'finalize'));
export const setDocumentStatus = async (id: string, status: DocumentStatus) => settle(await action(id, 'status', { status }));
export const convertDocument = async (id: string, type: DocumentType) => settle(await action(id, 'convert', { type }));
export const cancelInvoice = async (id: string) => settle(await action(id, 'cancel'));
export const duplicateDocument = async (id: string) => settle(await action(id, 'duplicate'));

export async function deleteDocument(id: string, options: { keepalive?: boolean } = {}): Promise<void> {
    await api<void>(keys.document(id), { method: 'DELETE', keepalive: options.keepalive });
    void invalidate('/api/documents', [keys.document(id)]);
}

export function fetchXml(id: string): Promise<string> {
    return apiText(keys.documentXml(id));
}
