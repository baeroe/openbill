import { createServer, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { RenderResult, RenderSchema, RenderSources } from '../../shared/protocol';

export type Recorded = { method: string; path: string; headers: IncomingHttpHeaders; body: string };
export type Reply = { status?: number; json?: unknown; body?: Uint8Array | string; contentType?: string; delayMs?: number };
export type Handler = (request: Recorded) => Reply | Promise<Reply>;

export type FakeOpenbill = {
    url: string;
    requests: Recorded[];
    /** Replaces the answer for one method + path. */
    on(method: string, path: string, handler: Handler): void;
    close(): Promise<void>;
};

export const SAMPLE_RESULT: RenderResult = {
    header: '<p>Studio Nordlicht</p>',
    body: '<p>Rechnung</p>',
    footer: '<p>Seite</p>',
    paper: { format: 'A4', marginX: '20mm', headerHeight: '30mm', footerHeight: '20mm' },
    errors: [],
};

export const SAMPLE_SOURCES: RenderSources = {
    scenarios: [
        { key: 'short_invoice', document_type: 'invoice' },
        { key: 'long_invoice', document_type: 'invoice' },
    ],
    documents: [{ id: '01kdochafenkontor', type: 'invoice', status: 'draft', number: null, date: '2026-10-12', customer_name: 'Hafenkontor Lindqvist', locale: 'de' }],
};

export const SAMPLE_SCHEMA: RenderSchema = {
    levels: {
        org: { context: 'org', core: ['name', 'logo'], custom: [] },
        customer: { context: 'customer', core: ['name'], custom: [] },
        contact: { context: 'contact', core: ['name'], custom: [] },
        document: { context: 'document', core: ['number', 'date', 'gross_total'], custom: [{ key: 'po_number', label: 'PO number', type: 'text', required: false, options: [], doc_types: ['invoice'] }] },
        position: { context: 'positions[]', core: ['title', 'quantity'], custom: [] },
    },
};

/** A tiny stand-in for an openbill instance: records every request and answers per method + path (default: sample data). */
export async function startFakeOpenbill(): Promise<FakeOpenbill> {
    const requests: Recorded[] = [];
    const handlers = new Map<string, Handler>([
        ['POST /api/render', () => ({ json: { ...SAMPLE_RESULT, totals: {}, issues: [] } })],
        ['GET /api/render/sources', () => ({ json: SAMPLE_SOURCES })],
        ['GET /api/render/schema', () => ({ json: SAMPLE_SCHEMA })],
    ]);

    const server = createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
            void (async () => {
                const recorded: Recorded = { method: req.method ?? 'GET', path: (req.url ?? '/').split('?')[0], headers: req.headers, body: Buffer.concat(chunks).toString('utf8') };
                requests.push(recorded);
                const handler = handlers.get(`${recorded.method} ${recorded.path}`);
                const reply: Reply = handler ? await handler(recorded) : { status: 404, json: { status: 404, title: 'Not Found', detail: '', reason: 'not_found' } };
                if (reply.delayMs) await new Promise((resolve) => setTimeout(resolve, reply.delayMs));
                if (res.destroyed) return;
                const status = reply.status ?? 200;
                const json = reply.json !== undefined;
                res.writeHead(status, { 'Content-Type': reply.contentType ?? (json ? (status >= 400 ? 'application/problem+json' : 'application/json') : 'application/octet-stream') });
                res.end(json ? JSON.stringify(reply.json) : (reply.body ?? ''));
            })();
        });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    return {
        url: `http://127.0.0.1:${port}`,
        requests,
        on: (method, path, handler) => void handlers.set(`${method} ${path}`, handler),
        close: () =>
            new Promise<void>((resolve) => {
                server.closeAllConnections();
                server.close(() => resolve());
            }),
    };
}
