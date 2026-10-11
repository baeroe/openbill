import { router } from '@inertiajs/react';
import { useEffect, useMemo, useRef } from 'react';
import { mutate } from 'swr';
import useSWRMutation from 'swr/mutation';
import { saveDraft } from '@/api/documents';
import { keys } from '@/api/keys';
import type { DocumentDetail } from '@/api/types';
import { ApiError, errorMessage } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Autosave } from './autosave';
import { fromDocument, samePayload, toPayload } from './ops';
import { fieldErrors } from './paths';
import { useEditor } from './store';
import type { DraftPayload } from './types';

/**
 * Connects the editor store with the autosave: local changes go out 600 ms after the last one as an SWR mutation of the
 * document key (the answer becomes the cached document), server states are taken over while nothing is pending, and
 * leaving the page saves first. The editor component is keyed by document id, so one instance serves one document.
 */
export function useAutosave(id: string, document: DocumentDetail | undefined): { flush(): Promise<void>; retry(): void; stop(): void } {
    const { trigger } = useSWRMutation(keys.document(id), (_key: string, { arg }: { arg: DraftPayload }) => saveDraft(id, arg), {
        populateCache: true,
        revalidate: false,
    });
    const triggerRef = useRef(trigger);
    useEffect(() => {
        triggerRef.current = trigger;
    }, [trigger]);

    const autosave = useMemo(() => {
        const mine = () => useEditor.getState().draft?.id === id;
        return new Autosave({
            revision: () => useEditor.getState().revision,
            payload: () => {
                const draft = useEditor.getState().draft;
                return draft && draft.id === id && draft.status === 'draft' ? toPayload(draft) : null;
            },
            save: async (payload) => {
                const saved = await triggerRef.current(payload);
                // SWR types the answer as optional; PATCH always answers with the document
                if (!saved) throw new Error('PATCH /api/documents answered without a document.');
                return saved;
            },
            onSaved: (sent, saved) => {
                if (mine()) useEditor.getState().applySaved(sent, saved);
            },
            onState: (state, error, sent) => {
                if (!mine()) return;
                const store = useEditor.getState();
                store.setSave(state, error ?? null);
                if (state === 'invalid' && error instanceof ApiError) {
                    store.setErrors(fieldErrors(sent ?? { groups: [] }, error.violations));
                    if (error.violations.length === 0) toast.error(errorMessage(error));
                }
                // finalized or deleted elsewhere: show the server state (read-only) or the not-found state
                if (state === 'locked' || state === 'gone') void mutate(keys.document(id));
            },
        });
    }, [id]);

    // server state → store: a new document, a changed lock, or an external change while nothing is pending
    useEffect(() => {
        if (!document || document.id !== id) return;
        const store = useEditor.getState();
        const fresh = store.draft === null || store.draft.id !== id;
        const lockChanged = !fresh && (store.draft!.status !== 'draft') !== document.is_locked;
        const external = !fresh && !autosave.pending && !samePayload(toPayload(fromDocument(document)), store.synced);
        if (fresh || lockChanged || external) {
            store.load(document);
            autosave.reset();
        }
    }, [document, id, autosave]);

    // every local change (re)starts the debounce; load() bumps the revision too, reset() right after cancels that
    useEffect(
        () =>
            useEditor.subscribe((state, previous) => {
                if (state.revision !== previous.revision && state.draft?.id === id) autosave.changed();
            }),
        [autosave, id],
    );

    // leaving: Inertia visits and unmount save in the background (the SPA stays loaded), closing the tab uses keepalive
    useEffect(() => {
        const onPageHide = () => autosave.flushKeepalive((payload) => void saveDraft(id, payload, { keepalive: true }).catch(() => undefined));
        window.addEventListener('pagehide', onPageHide);
        const off = router.on('before', () => {
            void autosave.flush();
        });
        return () => {
            window.removeEventListener('pagehide', onPageHide);
            off();
            void autosave.flush();
        };
    }, [autosave, id]);

    return useMemo(
        () => ({
            flush: () => autosave.flush(),
            retry: () => void autosave.retry(),
            stop: () => autosave.stop(),
        }),
        [autosave],
    );
}
