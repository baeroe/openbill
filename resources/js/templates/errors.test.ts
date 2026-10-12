import { describe, expect, it } from 'vitest';
import type { RenderSchema } from '@/api/templates';
import { errorLabel, errorsByPart, missingExpectedFields } from './errors';

describe('errorsByPart', () => {
    it('sorts render errors into the tabs and leaves document texts out', () => {
        const byPart = errorsByPart([
            { part: 'body', file: 'template.liquid', line: 12, message: 'Unknown filter "moneys"' },
            { part: 'header', file: 'header.liquid', line: null, message: 'Output too large' },
            { part: 'intro', file: null, line: 1, message: 'Unclosed tag' },
            { part: 'manifest', file: 'manifest.json', line: null, message: 'paper.marginX is invalid' },
        ]);

        expect(byPart.body).toEqual([{ line: 12, message: 'Unknown filter "moneys"' }]);
        expect(byPart.header).toEqual([{ line: null, message: 'Output too large' }]);
        expect(byPart.manifest).toHaveLength(1);
        expect(byPart.footer).toEqual([]);
        expect(byPart.css).toEqual([]);
    });
});

describe('errorLabel', () => {
    it('names file and line, or the part', () => {
        expect(errorLabel({ part: 'body', file: 'template.liquid', line: 12, message: '' })).toBe('template.liquid:12');
        expect(errorLabel({ part: 'intro', file: null, line: null, message: '' })).toBe('intro');
    });
});

describe('missingExpectedFields', () => {
    const schema = {
        levels: {
            org: { context: 'org', core: ['name'], custom: [] },
            customer: { context: 'customer', core: ['name'], custom: [] },
            contact: { context: 'contact', core: [], custom: [] },
            document: { context: 'document', core: ['number'], custom: [{ key: 'project_name', label: 'Project', type: 'text', required: false, options: [], doc_types: ['invoice'] }] },
            position: { context: 'positions[]', core: ['title'], custom: [] },
        },
    } as RenderSchema;

    it('lists expected fields that are neither core nor custom fields', () => {
        const manifest = {
            name: 'Fjord',
            version: '1.0.0',
            expectedFields: [
                { scope: 'document' as const, key: 'project_name', type: 'text' as const },
                { scope: 'document' as const, key: 'number', type: 'text' as const },
                { scope: 'position' as const, key: 'ticket', type: 'text' as const },
            ],
        };

        expect(missingExpectedFields(manifest, schema)).toEqual([{ scope: 'position', key: 'ticket', type: 'text' }]);
        expect(missingExpectedFields({ name: 'A', version: '1.0.0' }, schema)).toEqual([]);
    });
});
