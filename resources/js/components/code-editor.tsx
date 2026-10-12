import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { liquid } from '@codemirror/lang-liquid';
import { setDiagnostics } from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { toDiagnostics, type LineError } from '@/templates/diagnostics';

export type CodeEditorHandle = { insert(text: string): void; goToLine(line: number): void; focus(): void };

type Props = {
    value: string;
    onChange(value: string): void;
    language: 'liquid' | 'css' | 'json';
    readOnly?: boolean;
    ariaLabel: string;
    /** Template errors of this part: marked at their line (gutter, underline, tooltip). */
    errors?: LineError[];
    ref?: Ref<CodeEditorHandle>;
};

/** Colors from the app tokens, so light and dark mode follow data-theme. */
const theme = EditorView.theme({
    '&': { height: '100%', fontSize: '12.5px', backgroundColor: 'var(--surface)', color: 'var(--ink)' },
    '.cm-content': { fontFamily: 'var(--font-code)', caretColor: 'var(--accent)' },
    '.cm-gutters': { backgroundColor: 'var(--surface-2)', color: 'var(--faint)', border: 'none' },
    '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'color-mix(in srgb, var(--accent) 7%, transparent)' },
    '&.cm-focused': { outline: 'none' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--accent-soft) !important' },
    '.cm-scroller': { overflow: 'auto' },
});

const languages = { liquid, css, json };

/** CodeMirror 6 for Liquid, CSS and the manifest (JSON). The document follows `value`; changes go out through onChange. */
export function CodeEditor({ value, onChange, language, readOnly = false, ariaLabel, errors = [], ref }: Props) {
    const host = useRef<HTMLDivElement>(null);
    const view = useRef<EditorView | null>(null);
    const changeRef = useRef(onChange);
    const errorsRef = useRef(errors);

    useEffect(() => {
        changeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        const editor = new EditorView({
            parent: host.current!,
            state: EditorState.create({
                doc: value,
                extensions: [
                    basicSetup,
                    languages[language](),
                    theme,
                    EditorState.readOnly.of(readOnly),
                    EditorView.lineWrapping,
                    EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
                    EditorView.updateListener.of((update) => {
                        if (update.docChanged) changeRef.current(update.state.doc.toString());
                    }),
                ],
            }),
        });
        editor.dispatch(setDiagnostics(editor.state, toDiagnostics(editor.state.doc, errorsRef.current)));
        view.current = editor;
        return () => {
            editor.destroy();
            view.current = null;
        };
        // a new language or read-only mode builds a new editor; value and errors follow in their own effects
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [language, readOnly, ariaLabel]);

    // outside changes (discard, paper form → manifest text, after saving)
    useEffect(() => {
        const editor = view.current;
        if (editor && editor.state.doc.toString() !== value) editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
    }, [value]);

    useEffect(() => {
        errorsRef.current = errors;
        const editor = view.current;
        if (editor) editor.dispatch(setDiagnostics(editor.state, toDiagnostics(editor.state.doc, errors)));
    }, [errors]);

    useImperativeHandle(
        ref,
        () => ({
            insert(text) {
                const editor = view.current;
                if (!editor || readOnly) return;
                const { from, to } = editor.state.selection.main;
                editor.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length }, scrollIntoView: true });
                editor.focus();
            },
            goToLine(line) {
                const editor = view.current;
                if (!editor) return;
                const target = editor.state.doc.line(Math.max(1, Math.min(line, editor.state.doc.lines)));
                editor.dispatch({ selection: { anchor: target.from }, effects: EditorView.scrollIntoView(target.from, { y: 'center' }) });
                editor.focus();
            },
            focus() {
                view.current?.focus();
            },
        }),
        [readOnly],
    );

    return <div ref={host} className="code-editor h-full min-h-0 overflow-hidden" />;
}
