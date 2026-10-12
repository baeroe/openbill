import type { Diagnostic } from '@codemirror/lint';
import type { Text } from '@codemirror/state';

/** A template error of one part (RenderError of POST /api/render, line 1-based or unknown). */
export type LineError = { line: number | null; message: string };

/** CodeMirror diagnostics for the errors of one part: the whole line, lines past the end on the last line. */
export function toDiagnostics(doc: Text, errors: LineError[]): Diagnostic[] {
    return errors
        .filter((error): error is { line: number; message: string } => error.line !== null && error.line >= 1)
        .map((error) => {
            const line = doc.line(Math.min(error.line, doc.lines));
            return { from: line.from, to: line.to, severity: 'error', message: error.message };
        });
}
