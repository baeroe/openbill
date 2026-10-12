import { mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import { pack, slug } from './pack';
import { LIMITS, TemplateProblemError } from './template-files';

let root: string;
let lines: string[];

function write(name: string, contents: string): void {
    const file = path.join(root, 'template', name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, contents);
}

const log = (line: string) => lines.push(line);
const zips = () => readdirSync(root).filter((name) => name.endsWith('.zip'));

beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'kit-pack-'));
    lines = [];
    write('manifest.json', '{"name":"Hotel Alpenglück Rechnung","version":"1.2.0"}');
    write('template.liquid', '<h1>{{ document.number }}</h1>');
    write('header.liquid', '<p>Hotel Alpenglück</p>');
    write('assets/fonts/brand.woff2', 'wOF2');
    write('.DS_Store', '');
});

describe('pack', () => {
    it('packs template/ in the layout of the import, without hidden files', async () => {
        const target = await pack(root, { log });

        expect(path.basename(target)).toBe('hotel-alpengluck-rechnung-1.2.0.zip');
        expect(Object.keys(unzipSync(readFileSync(target))).sort()).toEqual(['assets/fonts/brand.woff2', 'header.liquid', 'manifest.json', 'template.liquid']);
        expect(lines).toEqual(['Packed 4 files into hotel-alpengluck-rechnung-1.2.0.zip (import it under Templates → Import ZIP).']);
    });

    it('writes to --out', async () => {
        const target = await pack(root, { out: 'dist/alpenglueck.zip', log });

        expect(target).toBe(path.join(root, 'dist', 'alpenglueck.zip'));
        expect(Object.keys(unzipSync(readFileSync(target)))).toContain('template.liquid');
    });

    it('refuses symbolic links and unknown files and writes no ZIP', async () => {
        write('notes.txt', 'todo');
        symlinkSync('/etc/hostname', path.join(root, 'template', 'assets', 'link.svg'));

        const error = await pack(root, { log }).then(() => null, (e: unknown) => e);

        expect(error).toBeInstanceOf(TemplateProblemError);
        expect((error as TemplateProblemError).problems).toEqual(['assets/link.svg: symbolic links are not allowed.', expect.stringMatching(/^notes\.txt: unknown file/)]);
        expect(zips()).toEqual([]);
    });

    it('needs name and version in manifest.json', async () => {
        write('manifest.json', '{"name":"Kulturwerk Elbinsel"}');

        const error = await pack(root, { log }).then(() => null, (e: unknown) => e);

        expect((error as TemplateProblemError).message).toBe('No package was written: manifest.json needs "name" and "version".');
        expect(zips()).toEqual([]);
    });
});

describe('package size', () => {
    it('writes no ZIP larger than the import takes (already compressed assets)', async () => {
        for (let i = 0; i < 6; i++) writeFileSync(path.join(root, 'template', 'assets', `photo-${i}.png`), randomBytes(LIMITS.assetBytes - 1024));

        const error = await pack(root, { log }).then(() => null, (e: unknown) => e);

        expect(error).toBeInstanceOf(TemplateProblemError);
        expect((error as TemplateProblemError).problems[0]).toMatch(/^The package would be \d+\.\d MB, at most 10\.0 MB are allowed\.$/);
        expect(zips()).toEqual([]);
    });
});

describe('slug', () => {
    it.each([
        ['Hotel Alpenglück', 'hotel-alpengluck'],
        ['  Fjord Analytics – Brief  ', 'fjord-analytics-brief'],
        ['!!!', 'template'],
    ])('%s → %s', (name, expected) => {
        expect(slug(name)).toBe(expected);
    });
});
