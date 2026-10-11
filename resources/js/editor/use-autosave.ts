import { router } from '@inertiajs/react';
import { useEffect, useMemo } from 'react';
import type { DocumentDetail } from '@/api/types';
import { autosaveFor, releaseAutosave, retainAutosave, showDocument } from './autosave-registry';
import { useEditor } from './store';

/**
 * Connects the editor of one document with its autosave (autosave-registry.ts: one instance per document, also across
 * leaving and coming back): local changes go out 600 ms after the last one, server states are taken over while
 * nothing is pending, and leaving the page saves first (closing the tab: keepalive, registered in the registry).
 * The editor component is keyed by document id, so one hook instance serves one document.
 */
export function useAutosave(id: string, document: DocumentDetail | undefined): { flush(): Promise<void>; retry(): void; stop(): void } {
    const entry = useMemo(() => autosaveFor(id), [id]);
    const { autosave } = entry;

    // unmount (and StrictMode's second mount): give the instance back; it keeps saving until everything is stored
    useEffect(() => {
        retainAutosave(entry);
        const off = router.on('before', () => {
            void autosave.flush();
        });
        return () => {
            off();
            void releaseAutosave(entry);
        };
    }, [entry, autosave]);

    // server state → store: opening the document (with its newest local input, if any), a changed lock, an external change
    useEffect(() => {
        if (document && document.id === id) showDocument(entry, document);
    }, [document, id, entry]);

    // every local change (re)starts the debounce; load() bumps the revision too, reset() right after cancels that
    useEffect(
        () =>
            useEditor.subscribe((state, previous) => {
                if (state.revision !== previous.revision && state.draft?.id === id) autosave.changed();
            }),
        [autosave, id],
    );

    return useMemo(
        () => ({
            flush: () => autosave.flush(),
            retry: () => void autosave.retry(),
            stop: () => autosave.stop(),
        }),
        [autosave],
    );
}
