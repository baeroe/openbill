import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BRIDGE_ID, isLocalHost, isSource, openbillRender } from './plugin';
import { startFakeOpenbill, type FakeOpenbill } from './test-support/fake-openbill';

type Payload = { type: string; event?: string; data?: any };

let fake: FakeOpenbill;
let server: ViteDevServer;
let root: string;
let port: number;
let sent: Payload[];

function raw(options: { path: string; method?: string; headers?: Record<string, string>; body?: string }): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
        const req = request({ host: '127.0.0.1', port, path: options.path, method: options.method ?? 'GET', headers: options.headers }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk: string) => (body += chunk));
            res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
        });
        req.on('error', reject);
        req.end(options.body);
    });
}

beforeEach(async () => {
    fake = await startFakeOpenbill();
    root = mkdtempSync(path.join(tmpdir(), 'kit-plugin-'));
    mkdirSync(path.join(root, 'template'));
    writeFileSync(path.join(root, 'template', 'manifest.json'), '{"name":"Fjord Brief","version":"1.0.0"}');
    writeFileSync(path.join(root, 'template', 'template.liquid'), '<h1>Fjord v1</h1>');
    writeFileSync(path.join(root, '.env.local'), 'OPENBILL_TOKEN="1|openbill_secret_in_file"\n');
    writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><head></head><body><div id="root"></div></body></html>');
    sent = [];
    server = await createServer({
        root,
        configFile: false,
        logLevel: 'silent',
        clearScreen: false,
        optimizeDeps: { noDiscovery: true, include: [] },
        server: { host: '127.0.0.1', port: 0 },
        plugins: [openbillRender({ env: { url: fake.url, token: '1|openbill_test', templateId: '01kfjord' }, debounceMs: 20 })],
    });
    // every way Vite talks to the page: the plugin's custom events and Vite's own full reloads
    const record = ((payload: Payload) => void sent.push(payload)) as never;
    vi.spyOn(server.ws, 'send').mockImplementation(record);
    if ((server.environments.client.hot as unknown) !== server.ws) vi.spyOn(server.environments.client.hot, 'send').mockImplementation(record);
    await server.listen();
    port = (server.httpServer?.address() as AddressInfo).port;
});

afterEach(async () => {
    await server.close();
    await fake.close();
    vi.restoreAllMocks();
});

const renderEvents = () => sent.filter((payload) => payload.type === 'custom' && payload.event === 'openbill:render');
const renderBodies = () => fake.requests.filter((r) => r.path === '/api/render').map((r) => (JSON.parse(r.body) as { template: { body: string } }).template.body);

/** chokidar needs a moment after the start: write again until the change has been rendered. */
async function writeUntil(file: string, contents: string, done: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 40; attempt++) {
        writeFileSync(file, contents);
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (done()) return;
    }
    throw new Error(`no render after writing ${file}`);
}

describe('openbillRender', () => {
    it('renders on a change in template/ and sends openbill:render – never a full reload', async () => {
        await writeUntil(path.join(root, 'template', 'template.liquid'), '<h1>Fjord v2</h1>', () => renderBodies().includes('<h1>Fjord v2</h1>') && renderEvents().length > 0);

        expect(renderEvents().at(-1)?.data).toMatchObject({ failure: null, errors: [], manifest: { name: 'Fjord Brief' }, source: { kind: 'document' } });
        expect(fake.requests.find((r) => r.path === '/api/render')?.headers.authorization).toBe('Bearer 1|openbill_test');
        expect(sent.filter((payload) => payload.type === 'full-reload')).toEqual([]);
    });

    it('answers the page with sources, schema and the first render – never with the token', async () => {
        const response = await raw({ path: '/__openbill/state' });

        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toMatchObject({
            instance: fake.url,
            templateId: '01kfjord',
            failure: null,
            sources: { documents: [{ customer_name: 'Hafenkontor Lindqvist' }] },
            event: { result: { body: '<p>Rechnung</p>' } },
        });
        expect(response.body).not.toContain('openbill_test');
    });

    it('switches the source on POST /source, JSON only', async () => {
        const json = await raw({ path: '/__openbill/source', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'scenario', key: 'short_invoice', locale: 'de' }) });

        expect(json.status).toBe(200);
        expect(JSON.parse(fake.requests.filter((r) => r.path === '/api/render').at(-1)?.body ?? '{}')).toMatchObject({ scenario: 'short_invoice', locale: 'de' });
        expect((await raw({ path: '/__openbill/source', method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{"kind":"document","id":"01k"}' })).status).toBe(415);
        expect((await raw({ path: '/__openbill/source', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"kind":"other"}' })).status).toBe(422);
    });

    it('refuses other hosts (DNS rebinding) and never serves .env.local', async () => {
        const foreign = await raw({ path: '/__openbill/state', headers: { Host: 'openbill-rebind.example:5180' } });
        expect(foreign.status).toBe(403);
        expect(foreign.body).not.toContain('Hafenkontor');

        const env = await raw({ path: '/.env.local' });
        expect(env.status).not.toBe(200);
        expect(env.body).not.toContain('openbill_secret_in_file');
    });

    it('refuses requests of other origins, also other servers on localhost', async () => {
        const source = JSON.stringify({ kind: 'scenario', key: 'short_invoice', locale: 'de' });
        const json = { 'Content-Type': 'application/json' };

        expect((await raw({ path: '/__openbill/source', method: 'POST', headers: { ...json, Origin: 'http://localhost:3000' }, body: source })).status).toBe(403);
        expect((await raw({ path: '/__openbill/state', headers: { 'Sec-Fetch-Site': 'cross-site' } })).status).toBe(403);
        expect((await raw({ path: '/__openbill/state', headers: { 'Sec-Fetch-Site': 'same-site' } })).status).toBe(403);
        expect((await raw({ path: '/__openbill/source', method: 'POST', headers: { ...json, Origin: `http://127.0.0.1:${port}`, 'Sec-Fetch-Site': 'same-origin' }, body: source })).status).toBe(200);
    });

    it('injects the bridge module, and Vite gives it a hot context', async () => {
        const html = await server.transformIndexHtml('/', '<!doctype html><html><head></head><body></body></html>');
        expect(html).toContain(`src="${BRIDGE_ID}"`);

        const bridge = await raw({ path: BRIDGE_ID });
        expect(bridge.status).toBe(200);
        expect(bridge.body).toContain('createHotContext');
        expect(bridge.body).toContain('openbill:render');
    });
});

describe('isLocalHost', () => {
    it.each([
        ['localhost:5180', undefined, true],
        ['127.0.0.1:5180', undefined, true],
        ['[::1]:5180', undefined, true],
        ['kit.localhost', undefined, true],
        ['openbill-rebind.example', undefined, false],
        [undefined, undefined, false],
        ['laptop.example', ['laptop.example'], true],
        ['a.dev.example', ['.dev.example'], true],
        ['anything.example', true, true],
    ] as const)('%s with %s → %s', (host, allowed, expected) => {
        expect(isLocalHost(host, allowed as true | string[] | undefined)).toBe(expected);
    });
});

describe('isSource', () => {
    it('accepts scenarios with a language and documents with an id', () => {
        expect(isSource({ kind: 'scenario', key: 'long_invoice', locale: 'de' })).toBe(true);
        expect(isSource({ kind: 'document', id: '01kdoc' })).toBe(true);
        expect(isSource({ kind: 'scenario', key: 'long_invoice', locale: 'fr' })).toBe(false);
        expect(isSource({ kind: 'document', id: '' })).toBe(false);
        expect(isSource(null)).toBe(false);
    });
});
