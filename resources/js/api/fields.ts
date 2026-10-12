import useSWR from 'swr';
import { api, apiUpload } from '@/lib/api';
import { keys } from './keys';
import { invalidate } from './paged';
import type { FieldDefinition, FieldScope } from './types';

/** Custom field definitions of one level (not paginated), in their configured order. */
export function useFieldDefinitions(scope: FieldScope) {
    return useSWR<FieldDefinition[]>(keys.fieldDefinitions(scope));
}

/** All levels at once (tab counts on the fields page). */
export function useAllFieldDefinitions() {
    return useSWR<FieldDefinition[]>(keys.allFieldDefinitions());
}

/** What SaveFieldDefinition takes; scope and key only count when creating. */
export type FieldDefinitionInput = Omit<FieldDefinition, 'id' | 'sort'>;

const settle = () => invalidate('/api/field-definitions').then(() => invalidate('/api/render/schema'));

export async function saveFieldDefinition(input: FieldDefinitionInput, id?: string): Promise<FieldDefinition> {
    const body = id ? { label: input.label, type: input.type, required: input.required, default_value: input.default_value, help: input.help, options: input.options, doc_types: input.doc_types } : { ...input, key: input.key || null };
    const saved = await api<FieldDefinition>(id ? `/api/field-definitions/${id}` : '/api/field-definitions', { method: id ? 'PATCH' : 'POST', body });
    void settle();
    return saved;
}

export async function deleteFieldDefinition(id: string, options: { keepalive: boolean } = { keepalive: false }): Promise<void> {
    await api<void>(`/api/field-definitions/${id}`, { method: 'DELETE', keepalive: options.keepalive });
    void settle();
}

export async function reorderFieldDefinitions(scope: FieldScope, ids: string[]): Promise<void> {
    await api<void>('/api/field-definitions/reorder', { method: 'POST', body: { scope, ids } });
    void settle();
}

export function uploadImage(file: File): Promise<{ path: string; mime: string; size: number }> {
    const form = new FormData();
    form.append('file', file);
    return apiUpload<{ path: string; mime: string; size: number }>('/api/uploads', form);
}

/** "uploads/<ulid>.png" → URL of GET /api/uploads/{name}. */
export const uploadUrl = (path: string): string => `/api/${path}`;
