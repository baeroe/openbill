import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, apiPage, apiUrl, errorMessage, setUnauthenticatedHandler } from './api';

const json = (status: number, body: unknown, type = 'application/json') =>
    new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': type } });

const problem = (status: number, reason: string, extra: Record<string, unknown> = {}) =>
    json(status, { type: `urn:openbill:problem:${reason}`, title: 'Title', status, detail: `Detail ${reason}`, reason, ...extra }, 'application/problem+json');

let fetchMock: ReturnType<typeof vi.fn>;
let unauthenticated: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('document', { cookie: 'locale=en; XSRF-TOKEN=abc%3D%3D' });
    unauthenticated = vi.fn<() => void>();
    setUnauthenticatedHandler(unauthenticated);
});

afterEach(() => vi.unstubAllGlobals());

const sent = (call = 0) => {
    const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit];
    return { url, init, headers: init.headers as Record<string, string> };
};

describe('api', () => {
    it('reads JSON with the UI language and the session, without CSRF header', async () => {
        fetchMock.mockResolvedValue(json(200, { id: 'c1' }));

        await expect(api('/api/customers/c1')).resolves.toEqual({ id: 'c1' });
        const { url, init, headers } = sent();
        expect(url).toBe('/api/customers/c1');
        expect(init.method).toBe('GET');
        expect(init.credentials).toBe('same-origin');
        expect(headers.Accept).toBe('application/json');
        expect(headers['Accept-Language']).toBe('en');
        expect(headers['X-XSRF-TOKEN']).toBeUndefined();
    });

    it('writes JSON with the decoded XSRF cookie', async () => {
        fetchMock.mockResolvedValue(json(201, { id: 'c2' }));

        await api('/api/customers', { method: 'POST', body: { name: 'Fjord Analytics AB' } });
        const { init, headers } = sent();
        expect(init.body).toBe('{"name":"Fjord Analytics AB"}');
        expect(headers['Content-Type']).toBe('application/json');
        expect(headers['X-XSRF-TOKEN']).toBe('abc==');
    });

    it('patches as merge-patch', async () => {
        fetchMock.mockResolvedValue(json(200, {}));

        await api('/api/customers/c1', { method: 'PATCH', body: { city: 'Hamburg' } });
        expect(sent().headers['Content-Type']).toBe('application/merge-patch+json');
    });

    it('returns undefined for 204', async () => {
        fetchMock.mockResolvedValue(json(204, null));

        await expect(api('/api/customers/c1', { method: 'DELETE' })).resolves.toBeUndefined();
    });

    it('throws Problem Details with the first message per field', async () => {
        fetchMock.mockResolvedValue(
            problem(422, 'validation_failed', {
                violations: [
                    { path: 'email', message: 'The email field must be a valid email address.' },
                    { path: 'contacts.1.email', message: 'first' },
                    { path: 'contacts.1.email', message: 'second' },
                ],
            }),
        );

        const error = await api('/api/customers', { method: 'POST', body: {} }).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(422);
        expect((error as ApiError).reason).toBe('validation_failed');
        expect((error as ApiError).fieldErrors()).toEqual({
            email: 'The email field must be a valid email address.',
            'contacts.1.email': 'first',
        });
        expect(errorMessage(error)).toBe('Detail validation_failed');
    });

    it('turns an HTML error page into an ApiError with the status', async () => {
        fetchMock.mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' }));

        const error = (await api('/api/customers').catch((e: unknown) => e)) as ApiError;
        expect(error.status).toBe(502);
        expect(error.reason).toBe('http_error');
        expect(error.message).toBe('Bad Gateway');
    });

    it('renews the CSRF cookie once after 419 and repeats the request', async () => {
        fetchMock
            .mockResolvedValueOnce(problem(419, 'csrf_token_mismatch'))
            .mockResolvedValueOnce(new Response(null, { status: 204 }))
            .mockResolvedValueOnce(json(201, { id: 'c3' }));

        await expect(api('/api/customers', { method: 'POST', body: { name: 'Hotel Alpenglück' } })).resolves.toEqual({ id: 'c3' });
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(sent(1).url).toBe('/sanctum/csrf-cookie');
        expect(sent(2).url).toBe('/api/customers');
    });

    it('gives up after a second 419', async () => {
        fetchMock.mockResolvedValueOnce(problem(419, 'csrf_token_mismatch')).mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(problem(419, 'csrf_token_mismatch'));

        await expect(api('/api/customers', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 419 });
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('hands a lost session to the login handler', async () => {
        fetchMock.mockResolvedValue(problem(401, 'unauthenticated'));

        await expect(api('/api/customers')).rejects.toMatchObject({ status: 401 });
        expect(unauthenticated).toHaveBeenCalledOnce();
    });

    it('reports network failures as ApiError with status 0', async () => {
        fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(api('/api/customers')).rejects.toMatchObject({ status: 0, reason: 'network' });
    });

    it('passes aborts through untouched', async () => {
        const abort = new DOMException('The operation was aborted.', 'AbortError');
        fetchMock.mockRejectedValue(abort);

        await expect(api('/api/render', { method: 'POST', body: {} })).rejects.toBe(abort);
    });
});

describe('apiPage', () => {
    it('reads JSON-LD collections as a page', async () => {
        fetchMock.mockResolvedValue(json(200, { member: [{ id: 'd1' }], totalItems: 51, view: { next: '/api/documents?page=2' } }, 'application/ld+json'));

        await expect(apiPage('/api/documents?page=1&itemsPerPage=50')).resolves.toEqual({ items: [{ id: 'd1' }], total: 51, page: 1, hasMore: true });
        expect(sent().headers.Accept).toBe('application/ld+json');
    });

    it('knows the last page', async () => {
        fetchMock.mockResolvedValue(json(200, { member: [], totalItems: 0 }, 'application/ld+json'));

        await expect(apiPage('/api/documents?page=3')).resolves.toMatchObject({ page: 3, hasMore: false, total: 0 });
    });
});

describe('apiUrl', () => {
    it('leaves out empty filters', () => {
        expect(apiUrl('/api/documents', { type: 'invoice', status: '', q: undefined, customer_id: null, page: 2 })).toBe('/api/documents?type=invoice&page=2');
        expect(apiUrl('/api/documents')).toBe('/api/documents');
        expect(apiUrl('/api/documents', { q: 'Fjord & Co' })).toBe('/api/documents?q=Fjord+%26+Co');
    });
});
