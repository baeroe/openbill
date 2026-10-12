import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from './client';
import { pull } from './pull';
import { TemplateProblemError } from './template-files';
import { SAMPLE_SCHEMA, startFakeOpenbill, type FakeOpenbill } from './test-support/fake-openbill';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
const PACKAGE: Record<string, string> = {
    'manifest.json': '{\n    "name": "Fjord Brief",\n    "version": "1.2.0"\n}\n',
    'header.liquid': '<p>Studio Nordlicht</p>',
    'template.liquid': '<h1>v2</h1>',
    'footer.liquid': '',
    'styles.css': '',
    'assets/logo.svg': SVG,
};

let fake: FakeOpenbill;
let root: string;
let lines: string[];

const zip = (files: Record<string, string>) => zipSync(Object.fromEntries(Object.entries(files).map(([name, contents]) => [name, strToU8(contents)])));
const local = (name: string) => path.join(root, 'template', name);
function write(name: string, contents: string): void {
    mkdirSync(path.dirname(local(name)), { recursive: true });
    writeFileSync(local(name), contents);
}
const run = (force: boolean) => {
    const env = { url: fake.url, token: '1|openbill_test', templateId: '01kfjord' };
    return pull(root, env, createClient(env), { force, log: (line) => lines.push(line) });
};

beforeEach(async () => {
    fake = await startFakeOpenbill();
    fake.on('GET', '/api/templates/01kfjord/package', () => ({ body: zip(PACKAGE), contentType: 'application/zip' }));
    root = mkdtempSync(path.join(tmpdir(), 'kit-pull-'));
    lines = [];
});

afterEach(() => fake.close());

describe('pull', () => {
    it('fetches the template into a fresh kit and the field schema into schema.json', async () => {
        await run(false);

        expect(readFileSync(local('template.liquid'), 'utf8')).toBe('<h1>v2</h1>');
        expect(readFileSync(local('assets/logo.svg'), 'utf8')).toBe(SVG);
        expect(JSON.parse(readFileSync(path.join(root, 'schema.json'), 'utf8'))).toEqual(SAMPLE_SCHEMA);
        expect(lines).toEqual(['Pulled 6 files into template/ and the field schema into schema.json.']);
    });

    it('stops when local files differ and overwrites them only with --force', async () => {
        write('manifest.json', PACKAGE['manifest.json']);
        write('template.liquid', '<h1>my local work</h1>');
        write('assets/old.png', 'png');

        const error = await run(false).then(() => null, (e: unknown) => e);

        expect(error).toBeInstanceOf(TemplateProblemError);
        expect((error as TemplateProblemError).problems).toEqual(['assets/old.png', 'template.liquid']);
        expect(readFileSync(local('template.liquid'), 'utf8')).toBe('<h1>my local work</h1>');

        await run(true);

        expect(readFileSync(local('template.liquid'), 'utf8')).toBe('<h1>v2</h1>');
        expect(existsSync(local('assets/old.png'))).toBe(false);
    });

    it('refuses a package with unsafe or unknown paths and writes nothing', async () => {
        fake.on('GET', '/api/templates/01kfjord/package', () => ({ body: zip({ ...PACKAGE, '../evil.liquid': 'x', 'notes.txt': 'x' }), contentType: 'application/zip' }));

        const error = await run(true).then(() => null, (e: unknown) => e);

        expect((error as TemplateProblemError).problems).toEqual(['../evil.liquid: not written (unsafe or unknown path).', 'notes.txt: not written (unsafe or unknown path).']);
        expect(existsSync(path.join(root, 'template'))).toBe(false);
        expect(existsSync(path.join(root, 'evil.liquid'))).toBe(false);
    });

    describe.each([false, true])('never writes outside template/ through symbolic links (force: %s)', (force) => {
        const outside = () => path.join(root, 'outside');
        const failureOf = async () => run(force).then(() => null, (e: unknown) => e);

        it('refuses a symlinked template/ folder', async () => {
            mkdirSync(outside());
            writeFileSync(path.join(outside(), 'template.liquid'), 'outside');
            symlinkSync(outside(), path.join(root, 'template'));

            const error = await failureOf();

            expect(error).toBeInstanceOf(TemplateProblemError);
            expect(readFileSync(path.join(outside(), 'template.liquid'), 'utf8')).toBe('outside');
            expect(existsSync(path.join(outside(), 'manifest.json'))).toBe(false);
        });

        it('refuses a symlinked template/assets folder', async () => {
            mkdirSync(outside());
            write('manifest.json', PACKAGE['manifest.json']);
            symlinkSync(outside(), path.join(root, 'template', 'assets'));

            const error = await failureOf();

            expect(error).toBeInstanceOf(TemplateProblemError);
            expect((error as TemplateProblemError).problems).toContain('assets: symbolic links are not allowed.');
            expect(existsSync(path.join(outside(), 'logo.svg'))).toBe(false);
        });

        it('refuses a symlinked part', async () => {
            writeFileSync(outside(), 'outside');
            write('manifest.json', PACKAGE['manifest.json']);
            symlinkSync(outside(), local('template.liquid'));

            const error = await failureOf();

            expect(error).toBeInstanceOf(TemplateProblemError);
            expect(readFileSync(outside(), 'utf8')).toBe('outside');
        });
    });
});
