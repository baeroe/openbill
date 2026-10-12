import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClient, OpenbillError } from './client';
import { push } from './push';
import { LIMITS, TemplateProblemError } from './template-files';
import { startFakeOpenbill, type FakeOpenbill } from './test-support/fake-openbill';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"></svg>';

let fake: FakeOpenbill;
let root: string;
let lines: string[];

function write(name: string, contents: string | Buffer): void {
    const file = path.join(root, 'template', name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, contents);
}

const env = () => ({ url: fake.url, token: '1|openbill_test', templateId: '01kfjord' });
const run = () => push(root, env(), createClient(env()), (line) => lines.push(line));
const puts = () => fake.requests.filter((request) => request.method === 'PUT');
const failure = async (): Promise<unknown> => run().then(() => null, (error: unknown) => error);

beforeEach(async () => {
    fake = await startFakeOpenbill();
    fake.on('PUT', '/api/templates/01kfjord/files', (request) => ({
        json: { id: '01kfjord', name: 'Fjord Brief', version: '1.1.0', assets: Object.keys((JSON.parse(request.body) as { assets: object }).assets).map((p) => ({ path: p, size: 1 })) },
    }));
    root = mkdtempSync(path.join(tmpdir(), 'kit-push-'));
    write('manifest.json', '{"name":"Fjord Brief","version":"1.1.0"}');
    write('template.liquid', '<h1>{{ document.number }}</h1>');
    write('styles.css', 'h1 { color: #2f55d4; }');
    write('assets/logo.svg', SVG);
    lines = [];
});

afterEach(() => fake.close());

describe('push', () => {
    it('sends every part, the manifest and the complete asset list as base64', async () => {
        await run();

        expect(puts()).toHaveLength(1);
        expect(puts()[0].headers.authorization).toBe('Bearer 1|openbill_test');
        expect(JSON.parse(puts()[0].body)).toEqual({
            header: '',
            body: '<h1>{{ document.number }}</h1>',
            footer: '',
            css: 'h1 { color: #2f55d4; }',
            manifest: { name: 'Fjord Brief', version: '1.1.0' },
            assets: { 'assets/logo.svg': Buffer.from(SVG).toString('base64') },
        });
        expect(lines).toEqual([`Pushed "Fjord Brief" 1.1.0 (1 asset) to ${fake.url}.`]);
    });

    it('checks template/ before sending anything', async () => {
        write('notes.txt', 'todo');
        write('assets/huge.png', Buffer.alloc(LIMITS.assetBytes + 1));
        symlinkSync('/etc/hostname', path.join(root, 'template', 'assets', 'link.svg'));

        const error = await failure();

        expect(error).toBeInstanceOf(TemplateProblemError);
        expect((error as TemplateProblemError).problems).toHaveLength(3);
        expect(puts()).toHaveLength(0);
    });

    it('does not send a broken manifest.json', async () => {
        write('manifest.json', '{"name": "Fjord Brief",}');

        const error = (await failure()) as TemplateProblemError;

        expect(error.problems[0]).toMatch(/^manifest\.json:1: manifest\.json is not valid JSON/);
        expect(puts()).toHaveLength(0);
    });

    it.each([
        [403, { detail: 'This token is missing the rule template-write.' }, 'forbidden'],
        [409, { reason: 'template_built_in', detail: 'Built-in templates cannot be changed.' }, 'conflict'],
        [413, { detail: 'The request is too large.' }, 'too_large'],
        [422, { detail: 'Invalid.', violations: [{ path: 'assets.assets/logo.svg', message: 'The file is not an SVG image.' }] }, 'validation'],
    ] as const)('passes a %i of openbill on as readable failure', async (status, problem, kind) => {
        fake.on('PUT', '/api/templates/01kfjord/files', () => ({ status, json: { status, title: 'Refused', ...problem } }));

        const error = await failure();

        expect(error).toBeInstanceOf(OpenbillError);
        expect((error as OpenbillError).failure.kind).toBe(kind);
    });
});
