import { Text } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { toDiagnostics } from './diagnostics';

const doc = Text.of(['<h1>{{ document.number }}</h1>', '{% if x %}', '', 'end']);

describe('toDiagnostics', () => {
    it('marks the whole reported line', () => {
        expect(toDiagnostics(doc, [{ line: 2, message: 'Unclosed if' }])).toEqual([{ from: 31, to: 41, severity: 'error', message: 'Unclosed if' }]);
    });

    it('marks an empty line as a point and clamps lines past the end to the last line', () => {
        expect(toDiagnostics(doc, [{ line: 3, message: 'a' }])[0]).toMatchObject({ from: 42, to: 42 });
        expect(toDiagnostics(doc, [{ line: 99, message: 'b' }])[0]).toMatchObject({ from: 43, to: 46 });
    });

    it('leaves errors without a line to the error list', () => {
        expect(toDiagnostics(doc, [{ line: null, message: 'Output too large' }, { line: 0, message: 'zero' }])).toEqual([]);
    });
});
