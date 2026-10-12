import { router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import type { DocumentDetail } from '@/api/types';
import { acquireAutosave, releaseAutosave, showDocument, type AutosaveEntry } from './autosave-registry';
import type { SharedProps } from '@/types';
import { useEditor } from './store';
import { setDraftOwner } from './unsaved-drafts';

/**
 * Connects the editor of one document with its autosave (autosave-registry.ts: one instance per document, also across
 * leaving and coming back): local changes go out 600 ms after the last one, server states are taken over while
 * nothing is pending, and leaving the page saves first (closing the tab: keepalive, registered in the registry).
 * The entry is taken and held in one step in the mount effect – never during render, where a save answer arriving
 * before the effect could drop it and leave the editor with a dead entry. The editor is keyed by document id.
 */
export function useAutosave(id: string, document: DocumentDetail | undefined): { flush(): Promise<void>; retry(): void; stop(): void } {
    const [entry, setEntry] = useState<AutosaveEntry | null>(null);
    const user = usePage<SharedProps>().props.auth.user?.id ?? null;
    // before the effects below: whose kept input showDocument may hand out
    useEffect(() => setDraftOwner(user), [user]);

    useEffect(() => {
        const held = acquireAutosave(id);
        setEntry(held);
        const off = router.on('before', () => {
            void held.autosave.flush();
        });
        // every local change (re)starts the debounce; load() bumps the revision too, reset() right after cancels that
        const unsubscribe = useEditor.subscribe((state, previous) => {
            if (state.revision !== previous.revision && state.draft?.id === id) held.autosave.changed();
        });
        return () => {
            off();
            unsubscribe();
            // keeps saving until everything is stored; StrictMode's second mount takes the same entry again
            void releaseAutosave(held);
        };
    }, [id]);

    // server state → store: opening the document (with its newest local input, if any), a changed lock, an external change
    useEffect(() => {
        if (entry && document && document.id === id) showDocument(entry, document);
    }, [entry, document, id]);

    return useMemo(
        () => ({
            flush: () => entry?.autosave.flush() ?? Promise.resolve(),
            retry: () => void entry?.autosave.retry(),
            stop: () => entry?.autosave.stop(),
        }),
        [entry],
    );
}
