import { useCallback, useEffect, useRef, useState } from 'react'
import { useUpdateDocument } from '@/hooks/useDocuments'
import { toast } from '@/store/toast'
import type { Document } from '@/domain/types'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

/**
 * Lokaler Entwurf mit verzögertem Autosave. Der Editor rechnet und rendert immer mit dem lokalen Stand;
 * Serverstände überschreiben ihn nur, solange keine ungespeicherten Änderungen da sind.
 */
export function useDraft(doc: Document | undefined, delay = 600) {
  const [draft, setDraft] = useState<Document | null>(doc ?? null)
  const [state, setState] = useState<SaveState>('saved')
  const draftRef = useRef<Document | null>(draft)
  const pending = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const save = useUpdateDocument()
  const saveRef = useRef(save)
  useEffect(() => { saveRef.current = save }, [save])

  useEffect(() => {
    if (doc && (!pending.current || draftRef.current?.id !== doc.id)) {
      pending.current = false
      draftRef.current = doc
      setDraft(doc)
    }
  }, [doc])

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    const current = draftRef.current
    if (!pending.current || !current) return
    pending.current = false
    setState('saving')
    try {
      await saveRef.current.mutateAsync(current)
      setState(pending.current ? 'dirty' : 'saved')
    } catch (e) {
      pending.current = true
      setState('error')
      toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
    }
  }, [])

  const update = useCallback((fn: (d: Document) => Document) => {
    const current = draftRef.current
    if (!current || current.status !== 'draft') return
    const next = fn(current)
    draftRef.current = next
    setDraft(next)
    pending.current = true
    setState('dirty')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void flush() }, delay)
  }, [delay, flush])

  /** Verwirft ungespeicherte Änderungen (z. B. vor dem Löschen). */
  const discard = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    pending.current = false
    setState('saved')
  }, [])

  // Beim Verlassen nichts verlieren
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
    const current = draftRef.current
    if (pending.current && current) saveRef.current.mutate(current)
  }, [])

  return { draft, update, flush, discard, saveState: state }
}
