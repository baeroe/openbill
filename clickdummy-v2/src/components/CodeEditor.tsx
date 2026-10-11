import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { basicSetup, EditorView } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { css } from '@codemirror/lang-css'
import { liquid } from '@codemirror/lang-liquid'
import { json } from '@codemirror/lang-json'

export interface CodeEditorHandle { insert(text: string): void }

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '12.5px', backgroundColor: 'var(--surface)', color: 'var(--ink)' },
  '.cm-content': { fontFamily: 'var(--font-code)', caretColor: 'var(--accent)' },
  '.cm-gutters': { backgroundColor: 'var(--surface-2)', color: 'var(--faint)', border: 'none', borderRight: 'none' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'color-mix(in srgb, var(--accent) 7%, transparent)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--accent-soft) !important' },
  '.cm-scroller': { overflow: 'auto' },
})

/** CodeMirror 6 für Liquid, CSS und das Manifest (JSON). */
export const CodeEditor = forwardRef<CodeEditorHandle, { value: string; onChange(v: string): void; language: 'liquid' | 'css' | 'json'; readOnly?: boolean; ariaLabel: string }>(
  function CodeEditor({ value, onChange, language, readOnly, ariaLabel }, ref) {
    const host = useRef<HTMLDivElement>(null)
    const view = useRef<EditorView | null>(null)
    const changeRef = useRef(onChange)
    changeRef.current = onChange

    useEffect(() => {
      const v = new EditorView({
        parent: host.current!,
        state: EditorState.create({
          doc: value,
          extensions: [
            basicSetup,
            language === 'liquid' ? liquid() : language === 'json' ? json() : css(),
            theme,
            EditorState.readOnly.of(!!readOnly),
            EditorView.lineWrapping,
            EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
            EditorView.updateListener.of((u) => u.docChanged && changeRef.current(u.state.doc.toString())),
          ],
        }),
      })
      view.current = v
      return () => v.destroy()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [language, readOnly])

    // Externe Änderungen (z. B. Zurücksetzen) übernehmen
    useEffect(() => {
      const v = view.current
      if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } })
    }, [value])

    useImperativeHandle(ref, () => ({
      insert(text) {
        const v = view.current
        if (!v || readOnly) return
        const { from, to } = v.state.selection.main
        v.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } })
        v.focus()
      },
    }))

    return <div ref={host} style={{ height: '100%', minHeight: 0, overflow: 'hidden' }} />
  },
)
