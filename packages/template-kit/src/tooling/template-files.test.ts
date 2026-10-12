import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { excerpt, isSafePath, jsonErrorLine, LIMITS, listTemplateFiles, parseManifest, readTemplate } from './template-files';

function templateDir(files: Record<string, string | Buffer>): string {
    const dir = path.join(mkdtempSync(path.join(tmpdir(), 'kit-tpl-')), 'template');
    for (const [name, contents] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
        writeFileSync(path.join(dir, name), contents);
    }
    return dir;
}

describe('isSafePath', () => {
    it.each([
        ['assets/logo.svg', true],
        ['assets/fonts/brand.woff2', true],
        ['template.liquid', true],
        ['../evil.txt', false],
        ['assets/../../evil.svg', false],
        ['/etc/passwd', false],
        ['C:/evil.svg', false],
        ['assets\\logo.svg', false],
        ['assets//logo.svg', false],
        ['./manifest.json', false],
        ['', false],
    ])('%s → %s', (name, safe) => {
        expect(isSafePath(name)).toBe(safe);
    });
});

describe('parseManifest', () => {
    it('reads a JSON object', () => {
        expect(parseManifest('{"name": "Fjord Brief", "version": "1.0.0"}')).toEqual({ manifest: { name: 'Fjord Brief', version: '1.0.0' }, problem: null });
    });

    it('names the line of a syntax error', () => {
        const { manifest, problem } = parseManifest('{\n  "name": "Fjord Brief",\n}');

        expect(manifest).toBeNull();
        expect(problem?.line).toBe(3);
        expect(problem?.message).toMatch(/^manifest\.json is not valid JSON: /);
    });

    it('refuses anything but an object', () => {
        expect(parseManifest('["Fjord"]').problem).toEqual({ line: 1, message: 'manifest.json must be a JSON object.' });
    });

    it('turns a position into a line when the message has no line', () => {
        expect(jsonErrorLine('{\n\n x', 'Unexpected token x in JSON at position 4')).toBe(3);
        expect(jsonErrorLine('{}', 'something else')).toBeNull();
    });
});

describe('readTemplate', () => {
    it('reads the parts, missing optional parts are empty, a missing manifest is a problem', async () => {
        const dir = templateDir({ 'template.liquid': '<h1>{{ document.number }}</h1>', 'styles.css': 'h1 { color: navy; }' });

        const local = await readTemplate(dir);

        expect(local.parts).toEqual({ header: '', body: '<h1>{{ document.number }}</h1>', footer: '', css: 'h1 { color: navy; }' });
        expect(local.manifest).toBeNull();
        expect(local.manifestProblem).toEqual({ line: null, message: 'template/manifest.json is missing.' });
    });
});

describe('excerpt', () => {
    it('returns the lines around the error line', () => {
        expect(excerpt('a\nb\nc\nd\ne\nf', 2)).toEqual([
            { line: 1, text: 'a' },
            { line: 2, text: 'b' },
            { line: 3, text: 'c' },
            { line: 4, text: 'd' },
        ]);
    });
});

describe('listTemplateFiles', () => {
    it('lists package files, skips hidden files and reports everything the import would refuse', async () => {
        const dir = templateDir({
            'manifest.json': '{"name":"Fjord Brief","version":"1.0.0"}',
            'template.liquid': '<h1>Fjord</h1>',
            'assets/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
            'assets/fonts/brand.woff2': 'wOF2',
            'assets/run.sh': 'echo',
            'assets/huge.png': Buffer.alloc(LIMITS.assetBytes + 1),
            'notes.txt': 'todo',
            'partials/card.liquid': '',
            '.DS_Store': '',
            'assets/.gitkeep': '',
        });
        symlinkSync('/etc/hostname', path.join(dir, 'assets/link.svg'));

        const { entries, problems } = await listTemplateFiles(dir);

        expect(entries.map((entry) => entry.path)).toEqual(['assets/fonts/brand.woff2', 'assets/logo.svg', 'manifest.json', 'template.liquid']);
        expect(problems).toEqual([
            'assets/huge.png: 2.0 MB is larger than 2.0 MB per asset.',
            'assets/link.svg: symbolic links are not allowed.',
            'assets/run.sh: assets must be png, jpg, jpeg, gif, webp, svg, woff, woff2, ttf, otf.',
            'notes.txt: unknown file (allowed: manifest.json, header.liquid, template.liquid, footer.liquid, styles.css, assets/…).',
            'partials/: only assets/ may contain folders.',
        ]);
    });

    it('requires manifest.json and template.liquid', async () => {
        const { problems } = await listTemplateFiles(templateDir({ 'header.liquid': '' }));

        expect(problems).toEqual(['manifest.json is missing.', 'template.liquid is missing.']);
    });

    it('reports a missing template folder instead of throwing', async () => {
        const { entries, problems } = await listTemplateFiles(path.join(tmpdir(), 'kit-no-such-folder', 'template'));

        expect(entries).toEqual([]);
        expect(problems).toEqual(['template/ is missing.']);
    });
});
