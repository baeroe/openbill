import type { KitError, RenderResult, RenderSchema, RenderSources, Source, TemplateManifest } from '../shared/protocol';
import type { Part } from './template-files';

/** Problem Details of openbill (App\Support\Problem). */
export type Problem = { status?: number; title?: string; detail?: string; reason?: string; violations?: { path: string; message: string }[] };
export type RenderRequest = {
    template_id: string;
    template: Partial<Record<Part, string>> & { manifest?: TemplateManifest };
    scenario?: string;
    locale?: string;
    document_id?: string;
};
export type FilesBody = Record<Part, string> & { manifest: TemplateManifest; assets: Record<string, string> };
export type SavedTemplate = { id: string; name: string; version: string; assets: { path: string; size: number }[] };

export class OpenbillError extends Error {
    constructor(readonly failure: KitError) {
        super(failure.message);
        this.name = 'OpenbillError';
    }
}

export type OpenbillClient = {
    render(body: RenderRequest, signal?: AbortSignal): Promise<RenderResult>;
    sources(): Promise<RenderSources>;
    schema(): Promise<RenderSchema>;
    putFiles(templateId: string, body: FilesBody): Promise<SavedTemplate>;
    packageZip(templateId: string): Promise<Uint8Array>;
};

/** Body of POST /api/render: the local parts over the saved template, rendered with a document or a sample scenario. */
export function renderRequest(templateId: string, source: Source, template: RenderRequest['template']): RenderRequest {
    return source.kind === 'document'
        ? { template_id: templateId, template, document_id: source.id }
        : { template_id: templateId, template, scenario: source.key, locale: source.locale };
}

/** A readable explanation of an answer ≥ 400. */
export function describeFailure(status: number, problem: Problem | null, url: string): KitError {
    const detail = problem?.detail || problem?.title || '';
    const details = (problem?.violations ?? []).map((violation) => `${violation.path}: ${violation.message}`);
    if (status === 401) {
        return { kind: 'unauthorized', status, message: 'openbill refused the token (401): it was revoked or is wrong; download the toolkit again in the template editor, or put a new token into .env.local.', details };
    }
    if (status === 403) {
        return { kind: 'forbidden', status, message: 'The token may not do this (403). A toolkit token previews documents and writes only its own template (OPENBILL_TEMPLATE_ID).', details: detail ? [detail] : details };
    }
    if (status === 404) {
        return { kind: 'not_found', status, message: `Not found (404): ${url}. Is OPENBILL_TEMPLATE_ID right, and does the template still exist?`, details };
    }
    if (status === 409) {
        const message = problem?.reason === 'template_built_in' ? 'Built-in templates are read-only. Duplicate it in openbill and download the toolkit of the copy.' : detail || 'openbill refused the change (409).';
        return { kind: 'conflict', status, message, details };
    }
    if (status === 413) return { kind: 'too_large', status, message: detail || 'The request is too large for openbill (413). Make the assets smaller.', details };
    if (status === 422) return { kind: 'validation', status, message: detail || 'openbill refused the input (422).', details };
    return { kind: 'server', status, message: `openbill answered ${status}${detail ? `: ${detail}` : ''}.`, details };
}

export function networkFailure(url: string, cause: unknown): KitError {
    const origin = new URL(url).origin;
    const nested = (cause as { cause?: { code?: unknown } } | null)?.cause?.code;
    const code = typeof nested === 'string' ? nested : cause instanceof Error ? cause.message : String(cause);
    if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY/.test(code)) {
        return { kind: 'network', status: null, message: `Node does not trust the certificate of ${origin} (${code}). For a local instance with its own CA (DDEV, mkcert) start with NODE_OPTIONS=--use-system-ca.`, details: [] };
    }
    return { kind: 'network', status: null, message: `Cannot reach ${origin} (${code}). Is openbill running and OPENBILL_URL right? Without the instance there is no preview.`, details: [] };
}

export function createClient(env: { url: string; token: string }, fetchImpl: typeof fetch = fetch): OpenbillClient {
    const call = async (method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<Response> => {
        const url = `${env.url}${path}`;
        let response: Response;
        try {
            response = await fetchImpl(url, {
                method,
                signal,
                headers: { Authorization: `Bearer ${env.token}`, Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
                body: body === undefined ? undefined : JSON.stringify(body),
            });
        } catch (error) {
            if (signal?.aborted) throw error;
            throw new OpenbillError(networkFailure(url, error));
        }
        if (!response.ok) {
            let problem: Problem | null = null;
            try {
                problem = (await response.json()) as Problem;
            } catch {
                problem = null;
            }
            throw new OpenbillError(describeFailure(response.status, problem, url));
        }
        return response;
    };
    const json = async <T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> => (await (await call(method, path, body, signal)).json()) as T;
    const templatePath = (id: string) => `/api/templates/${encodeURIComponent(id)}`;

    return {
        render: (body, signal) => json<RenderResult>('POST', '/api/render', body, signal),
        sources: () => json<RenderSources>('GET', '/api/render/sources'),
        schema: () => json<RenderSchema>('GET', '/api/render/schema'),
        putFiles: (id, body) => json<SavedTemplate>('PUT', `${templatePath(id)}/files`, body),
        packageZip: async (id) => new Uint8Array(await (await call('GET', `${templatePath(id)}/package`)).arrayBuffer()),
    };
}
