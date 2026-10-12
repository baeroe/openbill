import { describe, expect, it } from 'vitest';
import type { TemplateDetail } from '@/api/templates';
import { editorReducer, initEditor, isDirty, parseManifest, savePayload, zoneOf } from './editor-state';

const template: TemplateDetail = {
    id: 't1',
    name: 'Fjord',
    slug: 'fjord',
    version: '1.0.0',
    author: 'Studio Nordlicht',
    license: 'MIT',
    description: null,
    built_in: false,
    document_types: ['invoice'],
    updated_at: null,
    manifest: { name: 'Fjord', version: '1.0.0', paper: { format: 'A4', marginX: '20mm', headerHeight: '30mm', footerHeight: '20mm' } },
    header: '<header>{{ org.name }}</header>',
    body: '<h1>{{ document.number }}</h1>',
    footer: '',
    css: 'h1 { font-size: 20px; }',
    assets: [],
};

describe('editor state', () => {
    it('starts clean on the content tab with the manifest as pretty JSON', () => {
        const state = initEditor(template);

        expect(state.part).toBe('body');
        expect(isDirty(state)).toBe(false);
        expect(state.manifestText).toBe(JSON.stringify(template.manifest, null, 2));
        expect(savePayload(state)).toEqual({ header: template.header, body: template.body, footer: '', css: template.css, manifest: template.manifest });
    });

    it('marks edits as unsaved and discards them', () => {
        const edited = editorReducer(initEditor(template), { type: 'edit', part: 'body', value: '<h1>{{ document.number }} {{ document.project_name }}</h1>' });

        expect(isDirty(edited)).toBe(true);
        expect(isDirty(editorReducer(edited, { type: 'discard' }))).toBe(false);
    });

    it('keeps the last valid manifest while the JSON is broken and refuses to save it (review focus)', () => {
        const broken = editorReducer(initEditor(template), { type: 'manifest_text', text: '{ "name": "Fjord", ' });

        expect(broken.manifestProblem?.code).toBe('invalid_json');
        expect(broken.files.manifest).toEqual(template.manifest);
        expect(isDirty(broken)).toBe(true);
        expect(savePayload(broken)).toBeNull();

        const array = editorReducer(broken, { type: 'manifest_text', text: '[]' });
        expect(array.manifestProblem).toEqual({ code: 'not_object' });

        const fixed = editorReducer(array, { type: 'manifest_text', text: JSON.stringify({ ...template.manifest, version: '1.1.0' }) });
        expect(fixed.manifestProblem).toBeNull();
        expect(savePayload(fixed)?.manifest.version).toBe('1.1.0');
    });

    it('writes paper changes into the manifest and its text', () => {
        const state = editorReducer(initEditor(template), { type: 'paper', patch: { marginX: '25mm' } });

        expect(state.files.manifest.paper).toEqual({ format: 'A4', marginX: '25mm', headerHeight: '30mm', footerHeight: '20mm' });
        expect(JSON.parse(state.manifestText).paper.marginX).toBe('25mm');
    });

    it('fills a missing paper with the defaults before patching', () => {
        const bare = { ...template, manifest: { name: 'Fjord', version: '1.0.0' } };
        const state = editorReducer(initEditor(bare), { type: 'paper', patch: { format: 'Letter' } });

        expect(state.files.manifest.paper).toEqual({ format: 'Letter', marginX: '20mm', headerHeight: '30mm', footerHeight: '20mm' });
    });

    it('is clean again after saving and takes the server state', () => {
        const edited = editorReducer(initEditor(template), { type: 'edit', part: 'css', value: 'h1 { color: red; }' });
        const saved = editorReducer(edited, { type: 'saved', template: { ...template, css: 'h1 { color: red; }' } });

        expect(isDirty(saved)).toBe(false);
        expect(saved.part).toBe(edited.part);
    });

    it('maps tabs to preview zones', () => {
        expect([zoneOf('header'), zoneOf('body'), zoneOf('footer'), zoneOf('css'), zoneOf('manifest')]).toEqual(['header', 'body', 'footer', null, null]);
    });

    it('parses manifests', () => {
        expect(parseManifest('{"name":"A","version":"1.0.0"}')).toEqual({ manifest: { name: 'A', version: '1.0.0' } });
        expect(parseManifest('nope')).toMatchObject({ problem: { code: 'invalid_json' } });
        expect(parseManifest('null')).toEqual({ problem: { code: 'not_object' } });
    });
});
