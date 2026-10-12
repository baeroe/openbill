import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main, USAGE, type Io } from './cli';
import { startFakeOpenbill, type FakeOpenbill } from './test-support/fake-openbill';

let fake: FakeOpenbill;
let root: string;
let out: string[];
let err: string[];
let io: Io;

beforeEach(async () => {
    fake = await startFakeOpenbill();
    root = mkdtempSync(path.join(tmpdir(), 'kit-cli-'));
    out = [];
    err = [];
    io = { root, out: (line) => out.push(line), err: (line) => err.push(line), environment: { OPENBILL_URL: fake.url, OPENBILL_TOKEN: '1|openbill_test', OPENBILL_TEMPLATE_ID: '01kfjord' } };
});

afterEach(() => fake.close());

describe('main', () => {
    it('prints the usage for unknown commands', async () => {
        expect(await main(['deploy'], io)).toBe(2);
        expect(err).toEqual([USAGE]);
    });

    it('explains a missing .env.local', async () => {
        expect(await main(['push'], { ...io, environment: {} })).toBe(1);
        expect(err[0]).toMatch(/Missing OPENBILL_URL, OPENBILL_TOKEN, OPENBILL_TEMPLATE_ID/);
    });

    it('lists the violations openbill reports for a push', async () => {
        mkdirSync(path.join(root, 'template'));
        writeFileSync(path.join(root, 'template', 'manifest.json'), '{"name":"Fjord Brief","version":"one"}');
        writeFileSync(path.join(root, 'template', 'template.liquid'), '<h1>Fjord</h1>');
        fake.on('PUT', '/api/templates/01kfjord/files', () => ({ status: 422, json: { status: 422, detail: 'The manifest is invalid.', violations: [{ path: 'manifest.version', message: 'Use a version like 1.0.0.' }] } }));

        expect(await main(['push'], io)).toBe(1);
        expect(err).toEqual(['The manifest is invalid.', '  - manifest.version: Use a version like 1.0.0.']);
    });

    it('lists the local problems of pack', async () => {
        expect(await main(['pack'], io)).toBe(1);
        expect(err).toEqual(['No package was written: fix template/ first.', '  - template/ is missing.']);
    });
});
