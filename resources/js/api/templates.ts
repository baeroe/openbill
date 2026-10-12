import useSWR from 'swr';
import { api, apiUpload } from '@/lib/api';
import { keys } from './keys';
import { invalidate } from './paged';
import type { DocumentStatus, DocumentType, FieldScope, FieldType, Paper, RenderResponse } from './types';

export type TemplateSummary = {
    id: string;
    name: string;
    slug: string;
    version: string;
    author: string;
    license: string;
    description: string | null;
    built_in: boolean;
    document_types: DocumentType[];
    updated_at: string | null;
};

export type ExpectedField = { scope: FieldScope; key: string; type: FieldType; fallback?: unknown };

export type TemplateManifest = {
    name: string;
    version: string;
    author?: string;
    license?: string;
    description?: string;
    documentTypes?: DocumentType[];
    expectedFields?: ExpectedField[];
    paper?: Paper;
    translations?: Record<string, Record<string, string>>;
};

export type TemplateDetail = TemplateSummary & {
    manifest: TemplateManifest;
    header: string;
    body: string;
    footer: string;
    css: string;
    assets: { path: string; mime: string; size: number }[];
};

export type TemplateFiles = Pick<TemplateDetail, 'header' | 'body' | 'footer' | 'css' | 'manifest'>;

export type RenderSources = {
    scenarios: { key: string; document_type: DocumentType }[];
    documents: { id: string; type: DocumentType; status: DocumentStatus; number: string | null; date: string; customer_name: string | null; locale: string }[];
};

export type SchemaField = { key: string; label: string; type: FieldType; required: boolean; options: string[]; doc_types: DocumentType[] };
export type RenderSchema = { levels: Record<FieldScope, { context: string; core: string[]; custom: SchemaField[] }> };

export type TemplateRenderRequest = { template_id: string; template?: Partial<TemplateFiles>; scenario?: string; document_id?: string };

const STATIC = { revalidateOnFocus: false };

export function useTemplates() {
    return useSWR<TemplateSummary[]>(keys.templates());
}

export function useTemplate(id: string) {
    return useSWR<TemplateDetail>(keys.template(id), STATIC);
}

export function useRenderSources() {
    return useSWR<RenderSources>(keys.renderSources(), STATIC);
}

export function useRenderSchema() {
    return useSWR<RenderSchema>(keys.renderSchema());
}

export function renderTemplate(body: TemplateRenderRequest, signal?: AbortSignal): Promise<RenderResponse> {
    return api<RenderResponse>('/api/render', { method: 'POST', body, signal });
}

export async function importTemplate(file: File): Promise<TemplateDetail> {
    const form = new FormData();
    form.append('package', file);
    const template = await apiUpload<TemplateDetail>('/api/templates', form);
    void invalidate('/api/templates');
    return template;
}

export async function duplicateTemplate(id: string): Promise<TemplateDetail> {
    const copy = await api<TemplateDetail>(`${keys.template(id)}/duplicate`, { method: 'POST', body: {} });
    void invalidate('/api/templates');
    return copy;
}

export async function deleteTemplate(id: string): Promise<void> {
    await api<void>(keys.template(id), { method: 'DELETE' });
    void invalidate('/api/templates');
}

export async function saveTemplateFiles(id: string, files: TemplateFiles): Promise<TemplateDetail> {
    const template = await api<TemplateDetail>(`${keys.template(id)}/files`, { method: 'PUT', body: files });
    void invalidate('/api/templates');
    return template;
}

/** Download of the saved state as template package (session cookie, same origin). */
export const packageUrl = (id: string): string => `${keys.template(id)}/package`;
