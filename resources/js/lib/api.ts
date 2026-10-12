import { getLocale, t } from '@/lib/i18n';

export type Violation = { path: string; message: string; code?: string };

/** Problem Details of every /api error (App\Support\Problem, RFC 9457). */
export type Problem = {
    type: string;
    title: string;
    status: number;
    detail: string;
    reason: string;
    violations?: Violation[];
    [extension: string]: unknown;
};

export class ApiError extends Error {
    readonly status: number;
    readonly problem: Problem;

    constructor(problem: Problem) {
        super(problem.detail || problem.title);
        this.name = 'ApiError';
        this.status = problem.status;
        this.problem = problem;
    }

    get reason(): string {
        return this.problem.reason;
    }

    get violations(): Violation[] {
        return this.problem.violations ?? [];
    }

    /** First message per path: "name", "contacts.1.email", "custom.industry", "groups.0.positions.2.title". */
    fieldErrors(): Record<string, string> {
        const errors: Record<string, string> = {};
        for (const violation of this.violations) errors[violation.path] ??= violation.message;
        return errors;
    }
}

export type ApiOptions = {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: unknown;
    signal?: AbortSignal;
    /** "jsonld" for paginated collections (total and next page); default plain JSON. */
    format?: 'json' | 'jsonld';
    /** Request outlives the page (saving while the tab closes; body ≤ 64 KB). */
    keepalive?: boolean;
    /** Multipart body (uploads); replaces body, the browser sets the Content-Type. */
    form?: FormData;
};

type Format = NonNullable<ApiOptions['format']> | 'text';

const ACCEPT: Record<Format, string> = { json: 'application/json', jsonld: 'application/ld+json', text: 'application/xml, application/problem+json' };

/** Path with query string; empty values (undefined, null, '', false) are left out. */
export function apiUrl(path: string, params: Record<string, string | number | boolean | null | undefined> = {}): string {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '' || value === false) continue;
        query.set(key, value === true ? '1' : String(value));
    }
    const qs = query.toString();
    return qs ? `${path}?${qs}` : path;
}

export function cookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const entry = document.cookie.split('; ').find((part) => part.startsWith(`${name}=`));
    return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

let onUnauthenticated = (): void => {
    window.location.assign(`/${getLocale()}/login`);
};

/** What happens when the session is gone (401). Default: the login page of the current language. */
export function setUnauthenticatedHandler(handler: () => void): void {
    onUnauthenticated = handler;
}

async function send(path: string, options: ApiOptions, format: Format): Promise<Response> {
    const method = options.method ?? 'GET';
    const headers: Record<string, string> = {
        Accept: ACCEPT[format],
        'Accept-Language': getLocale(),
        'X-Requested-With': 'XMLHttpRequest',
    };
    if (options.body !== undefined && !options.form) headers['Content-Type'] = method === 'PATCH' ? 'application/merge-patch+json' : 'application/json';
    // the session's CSRF token for writes (Sanctum "stateful" requests, phase 4)
    const xsrf = cookie('XSRF-TOKEN');
    if (xsrf && method !== 'GET') headers['X-XSRF-TOKEN'] = xsrf;

    try {
        return await fetch(path, {
            method,
            headers,
            credentials: 'same-origin',
            signal: options.signal,
            keepalive: options.keepalive,
            body: options.form ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw new ApiError({ type: 'urn:openbill:problem:network', title: t('errors.network'), status: 0, detail: t('errors.network'), reason: 'network' });
    }
}

async function problemOf(response: Response): Promise<Problem> {
    const fallback: Problem = {
        type: 'about:blank',
        title: response.statusText || t('errors.unknown'),
        status: response.status,
        detail: '',
        reason: 'http_error',
    };
    try {
        const body = (await response.json()) as Partial<Problem>;
        return { ...fallback, ...body, status: typeof body.status === 'number' ? body.status : response.status };
    } catch {
        return fallback;
    }
}

/** Sends, renews the CSRF cookie once on 419, sends 401 to the login and throws every answer ≥ 400 as ApiError. */
async function request(path: string, options: ApiOptions, format: Format): Promise<Response> {
    let response = await send(path, options, format);
    // 419: the CSRF token changed (e.g. a new login in another tab): fetch a fresh cookie, then try once more
    if (response.status === 419) {
        await fetch('/sanctum/csrf-cookie', { credentials: 'same-origin' });
        response = await send(path, options, format);
    }
    if (response.status === 401) onUnauthenticated();
    if (!response.ok) throw new ApiError(await problemOf(response));
    return response;
}

/** One request to the own API with the login session. Every answer ≥ 400 throws an ApiError. */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
    const response = await request(path, options, options.format ?? 'json');
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
}

/** A text answer (e-invoice XML); errors still arrive as Problem Details. */
/** POST of a multipart form (template ZIP, logo, image field) to the own API. */
export function apiUpload<T>(path: string, form: FormData, options: { signal?: AbortSignal } = {}): Promise<T> {
    return api<T>(path, { method: 'POST', form, signal: options.signal });
}

export async function apiText(path: string, options: Omit<ApiOptions, 'format'> = {}): Promise<string> {
    return (await request(path, options, 'text')).text();
}

/** attachment; filename=openbill-toolkit-fjord.zip – also quoted, or RFC 5987 filename*=UTF-8''… */
export function filenameOf(disposition: string | null): string | null {
    if (!disposition) return null;
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
    if (encoded) return decodeURIComponent(encoded[1]);
    const plain = /filename="?([^";]+)"?/i.exec(disposition);
    return plain ? plain[1] : null;
}

/** A file answer (toolkit ZIP) with its name; CSRF, 419 retry and 401 like api(), errors as ApiError. */
export async function apiBlob(path: string, options: Omit<ApiOptions, 'format'> = {}): Promise<{ blob: Blob; filename: string | null }> {
    const response = await request(path, options, 'json');
    return { blob: await response.blob(), filename: filenameOf(response.headers.get('Content-Disposition')) };
}

export type Page<T> = { items: T[]; total: number; page: number; hasMore: boolean };

type Collection<T> = { member: T[]; totalItems: number; view?: { next?: string } };

/** One page of a paginated collection (customers, documents), read as JSON-LD for the total. */
export async function apiPage<T>(path: string, signal?: AbortSignal): Promise<Page<T>> {
    const body = await api<Collection<T>>(path, { format: 'jsonld', signal });
    const page = Number(new URL(path, 'http://openbill.invalid').searchParams.get('page') ?? '1');
    return { items: body.member, total: body.totalItems, page, hasMore: body.view?.next !== undefined };
}

/** Text for a toast or an error state. */
export function errorMessage(error: unknown): string {
    if (error instanceof ApiError) return error.problem.detail || error.problem.title;
    if (error instanceof Error && error.message) return error.message;
    return t('errors.unknown');
}
