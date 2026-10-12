import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RenderEvent } from '../shared/protocol';
import { createClient } from './client';
import { createRuntime, defaultSource, type KitRuntime } from './runtime';
import { SAMPLE_RESULT, SAMPLE_SOURCES, startFakeOpenbill, type FakeOpenbill } from './test-support/fake-openbill';

const MANIFEST = '{"name":"Fjord Brief","version":"1.0.0"}';

let fake: FakeOpenbill;
let root: string;
let events: RenderEvent[];
let runtime: KitRuntime;

function write(name: string, contents: string): string {
    const file = path.join(root, 'template', name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, contents);
    return file;
}

const renders = () => fake.requests.filter((request) => request.path === '/api/render');
const lastBody = () => JSON.parse(renders().at(-1)?.body ?? '{}') as Record<string, any>;

beforeEach(async () => {
    fake = await startFakeOpenbill();
    root = mkdtempSync(path.join(tmpdir(), 'kit-runtime-'));
    write('manifest.json', MANIFEST);
    write('template.liquid', '<h1>{{ document.number }}</h1>');
    events = [];
    const env = { url: fake.url, token: '1|openbill_test', templateId: '01kfjord' };
    runtime = createRuntime({ root, env, client: createClient(env), send: (event) => events.push(event), debounceMs: 10 });
});

afterEach(async () => {
    runtime.dispose();
    await fake.close();
});

describe('createRuntime', () => {
    it('renders the local files once after several quick changes and sends one event', async () => {
        await runtime.state(); // first render with the default source
        events.length = 0;
        fake.requests.length = 0;

        const file = write('template.liquid', '<h1>v1</h1>');
        runtime.fileChanged(file);
        write('template.liquid', '<h1>v2</h1>');
        runtime.fileChanged(file);
        runtime.fileChanged(file);

        await vi.waitFor(() => expect(events).toHaveLength(1));
        expect(renders()).toHaveLength(1);
        expect(lastBody()).toEqual({
            template_id: '01kfjord',
            template: { header: '', body: '<h1>v2</h1>', footer: '', css: '', manifest: { name: 'Fjord Brief', version: '1.0.0' } },
            document_id: SAMPLE_SOURCES.documents[0].id,
        });
        expect(events[0]).toMatchObject({ result: SAMPLE_RESULT, errors: [], failure: null, notice: null, manifest: { name: 'Fjord Brief' } });
    });

    it('ignores files outside template/', async () => {
        runtime.fileChanged(path.join(root, 'README.md'));
        runtime.fileChanged(path.join(root, 'template-old', 'template.liquid'));

        await new Promise((resolve) => setTimeout(resolve, 60));
        expect(renders()).toHaveLength(0);
    });

    it('reports a broken manifest.json with its line and does not ask openbill', async () => {
        runtime.fileChanged(write('manifest.json', '{\n  "name": "Fjord Brief",\n}'));

        await vi.waitFor(() => expect(events).toHaveLength(1));
        expect(renders()).toHaveLength(0);
        expect(events[0].failure).toMatchObject({ kind: 'manifest', details: ['manifest.json:3'] });
    });

    it('adds lines of the local file to template errors and keeps showing the last good result', async () => {
        await runtime.render();
        fake.on('POST', '/api/render', () => ({ json: { ...SAMPLE_RESULT, body: '', errors: [{ part: 'body', file: 'template.liquid', line: 2, message: 'Unknown filter nope' }] } }));

        runtime.fileChanged(write('template.liquid', '<h1>Fjord</h1>\n{{ document.number | nope }}\n<p>end</p>'));

        await vi.waitFor(() => expect(events).toHaveLength(2));
        expect(events[1].result?.body).toBe(SAMPLE_RESULT.body);
        expect(events[1].errors[0].excerpt).toEqual([
            { line: 1, text: '<h1>Fjord</h1>' },
            { line: 2, text: '{{ document.number | nope }}' },
            { line: 3, text: '<p>end</p>' },
        ]);
    });

    it('turns a refused token into a failure and keeps the last good result', async () => {
        await runtime.render();
        fake.on('POST', '/api/render', () => ({ status: 401, json: { status: 401, title: 'Unauthorized', detail: 'Unauthenticated.' } }));

        const event = await runtime.render();

        expect(event.failure?.kind).toBe('unauthorized');
        expect(event.result).toMatchObject(SAMPLE_RESULT);
    });

    it('never lets an older, slower answer overwrite a newer one', async () => {
        let call = 0;
        fake.on('POST', '/api/render', () => {
            call++;
            return call === 1 ? { json: { ...SAMPLE_RESULT, body: '<p>old</p>' }, delayMs: 300 } : { json: { ...SAMPLE_RESULT, body: '<p>new</p>' } };
        });

        const slow = runtime.render();
        await vi.waitFor(() => expect(renders()).toHaveLength(1));
        const fast = await runtime.render();
        await slow;

        expect(fast.result?.body).toBe('<p>new</p>');
        expect(events.map((event) => event.result?.body)).toEqual(['<p>new</p>']);
    });

    it('notes changed assets (the preview uses the saved ones until push)', async () => {
        runtime.fileChanged(write('assets/logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>'));

        await vi.waitFor(() => expect(events).toHaveLength(1));
        expect(events[0].notice).toBe('assets_changed');
    });

    it('renders a chosen scenario in the chosen language', async () => {
        const event = await runtime.setSource({ kind: 'scenario', key: 'long_invoice', locale: 'de' });

        expect(event.source).toEqual({ kind: 'scenario', key: 'long_invoice', locale: 'de' });
        expect(lastBody()).toMatchObject({ scenario: 'long_invoice', locale: 'de' });
    });

    it('loads sources and schema once and renders once for the first state', async () => {
        const first = await runtime.state();
        const second = await runtime.state();

        expect(fake.requests.filter((request) => request.path === '/api/render/sources')).toHaveLength(1);
        expect(renders()).toHaveLength(1);
        expect(second.event?.seq).toBe(first.event?.seq);
        expect(second).toMatchObject({ instance: fake.url, templateId: '01kfjord', failure: null, sources: SAMPLE_SOURCES });
    });
});

describe('recovery after a failed start', () => {
    it('loads sources and schema again after the first successful render that follows a failure', async () => {
        let up = false;
        fake.on('GET', '/api/render/sources', () => (up ? { json: SAMPLE_SOURCES } : { status: 503, json: { status: 503, detail: 'Starting.' } }));
        fake.on('POST', '/api/render', () => (up ? { json: SAMPLE_RESULT } : { status: 503, json: { status: 503, detail: 'Starting.' } }));

        const first = await runtime.state();
        expect(first.failure?.kind).toBe('server');
        expect(first.sources).toBeNull();
        const lookupsBefore = fake.requests.filter((request) => request.path === '/api/render/sources').length;

        up = true;
        const event = await runtime.render();

        expect(event.failure).toBeNull();
        expect(fake.requests.filter((request) => request.path === '/api/render/sources').length).toBe(lookupsBefore + 1);
        const requestsBefore = fake.requests.length;
        expect(await runtime.state()).toMatchObject({ failure: null, sources: SAMPLE_SOURCES });
        expect(fake.requests.length).toBe(requestsBefore);
    });
});

describe('edge cases of the review', () => {
    it('reports an unreadable template file instead of ending the dev server', async () => {
        const file = path.join(root, 'template', 'template.liquid');
        rmSync(file);
        mkdirSync(file);

        runtime.fileChanged(file);

        await vi.waitFor(() => expect(events).toHaveLength(1));
        expect(events[0].failure?.kind).toBe('config');
        expect(events[0].failure?.message).toContain('template/');
    });

    it('keeps the assets notice when a newer render overtakes the one that saw the change', async () => {
        let call = 0;
        fake.on('POST', '/api/render', () => (++call === 1 ? { json: SAMPLE_RESULT, delayMs: 300 } : { json: SAMPLE_RESULT }));
        await runtime.setSource({ kind: 'scenario', key: 'long_invoice', locale: 'en' });
        call = 0;
        events.length = 0;

        runtime.fileChanged(write('assets/logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>'));
        await vi.waitFor(() => expect(renders().length).toBeGreaterThanOrEqual(2));
        await runtime.render();

        expect(events.map((event) => event.notice)).toEqual(['assets_changed']);
    });

    it('answers an overtaken source change with the newest event, not with an abort failure', async () => {
        let call = 0;
        fake.on('POST', '/api/render', () => (++call === 1 ? { json: SAMPLE_RESULT, delayMs: 300 } : { json: { ...SAMPLE_RESULT, body: '<p>new</p>' } }));

        const switching = runtime.setSource({ kind: 'scenario', key: 'short_invoice', locale: 'de' });
        await vi.waitFor(() => expect(renders()).toHaveLength(1));
        const newest = await runtime.render();
        const answer = await switching;

        expect(answer.failure).toBeNull();
        expect(answer.seq).toBe(newest.seq);
        expect(answer.result?.body).toBe('<p>new</p>');
    });

    it('does not show the last good result of another data source', async () => {
        await runtime.setSource({ kind: 'document', id: SAMPLE_SOURCES.documents[0].id });
        fake.on('POST', '/api/render', () => ({ json: { ...SAMPLE_RESULT, body: '<p>broken</p>', errors: [{ part: 'body', file: 'template.liquid', line: 1, message: 'Unknown filter nope' }] } }));

        const event = await runtime.setSource({ kind: 'scenario', key: 'long_invoice', locale: 'en' });

        expect(event.result?.body).toBe('<p>broken</p>');
    });
});

describe('defaultSource', () => {
    it('takes the newest document, else the long sample invoice', () => {
        expect(defaultSource(SAMPLE_SOURCES)).toEqual({ kind: 'document', id: SAMPLE_SOURCES.documents[0].id });
        expect(defaultSource({ scenarios: [], documents: [] })).toEqual({ kind: 'scenario', key: 'long_invoice', locale: 'en' });
        expect(defaultSource(null)).toEqual({ kind: 'scenario', key: 'long_invoice', locale: 'en' });
    });
});
