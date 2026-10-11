import { mutate } from 'swr';
import { saveDraft } from '@/api/documents';
import { keys } from '@/api/keys';
import type { DocumentDetail } from '@/api/types';
import { ApiError, errorMessage } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Autosave } from './autosave';
import { draftSource, type DraftSource } from './draft-source';
import { fromDocument, samePayload, toPayload } from './ops';
import { fieldErrors } from './paths';
import { useEditor } from './store';
import type { DraftPayload } from './types';

export type Save = (id: string, payload: DraftPayload) => Promise<DocumentDetail>;
export type AutosaveEntry = { id: string; autosave: Autosave; source: DraftSource; users: number };

/** PATCH, then the answer becomes the cached document (what useSWRMutation's populateCache did). */
const patch: Save = async (id, payload) => {
    const saved = await saveDraft(id, payload);
    await mutate(keys.document(id), saved, { revalidate: false });
    return saved;
};

/**
 * At most one autosave per document, outliving its editor: leaving the page while a save or a retry is still running
 * and coming back takes over the same instance with its newest local state – no second instance, no older cached
 * state overwriting newer input. An entry is dropped once nothing is pending and no editor uses it.
 */
const entries = new Map<string, AutosaveEntry>();

function create(id: string, save: Save): AutosaveEntry {
    const source = draftSource(useEditor, id);
    const mine = () => useEditor.getState().draft?.id === id;
    const autosave = new Autosave({
        // the last state of this document, also while the editor shows another one
        revision: source.revision,
        payload: source.payload,
        save: (payload) => save(id, payload),
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
    return { id, autosave, source, users: 0 };
}

let listening = false;

/** Closing the tab: every document with unsaved input goes out with keepalive (also documents no editor shows). */
export function flushAllKeepalive(save: (id: string, payload: DraftPayload) => void = (id, payload) => void saveDraft(id, payload, { keepalive: true }).catch(() => undefined)): void {
    for (const entry of entries.values()) entry.autosave.flushKeepalive((payload) => save(entry.id, payload));
}

/** The autosave of a document: the running one from an earlier visit, or a new one. */
export function autosaveFor(id: string, save: Save = patch): AutosaveEntry {
    let entry = entries.get(id);
    if (!entry || entry.autosave.stopped) {
        entry?.source.unsubscribe();
        entry = create(id, save);
        entries.set(id, entry);
    }
    return entry;
}

/** An editor uses the entry (mount effect); pairs with releaseAutosave (cleanup). */
export function retainAutosave(entry: AutosaveEntry): void {
    entry.users++;
    if (entries.get(entry.id) !== entry && !entry.autosave.stopped) entries.set(entry.id, entry);
    if (!listening && typeof window !== 'undefined') {
        listening = true;
        window.addEventListener('pagehide', () => flushAllKeepalive());
    }
}

/**
 * The editor goes away: save what is open; the entry stays until that is on the server (retries included). Dropping
 * happens after the flush promise settles, so StrictMode's immediate remount retains it again first.
 */
export function releaseAutosave(entry: AutosaveEntry): Promise<void> {
    entry.users = Math.max(0, entry.users - 1);
    const drop = () => {
        if (entry.users > 0 || entries.get(entry.id) !== entry) return;
        if (entry.autosave.pending && !entry.autosave.stopped) return;
        entry.source.unsubscribe();
        entries.delete(entry.id);
    };
    return entry.autosave.flush().then(drop, drop);
}

/**
 * Server state → store while the editor shows the document. Opening it (the store holds another document) shows the
 * server state – or, while this document's autosave still has unsaved input, that input on top of it. Later only a
 * changed lock or an external change while nothing is pending replaces the local state.
 */
export function showDocument(entry: AutosaveEntry, document: DocumentDetail): void {
    const { autosave, source } = entry;
    const store = useEditor.getState();
    if (store.draft === null || store.draft.id !== entry.id) {
        const local = autosave.pending && !autosave.stopped ? source.payload() : null;
        store.load(document, local ? { payload: local, saveState: autosave.state } : undefined);
        if (local) autosave.changed();
        else autosave.reset();
        return;
    }
    const lockChanged = (store.draft.status !== 'draft') !== document.is_locked;
    const external = !autosave.pending && !samePayload(toPayload(fromDocument(document)), store.synced);
    if (lockChanged || external) {
        store.load(document);
        autosave.reset();
    }
}

/** Tests only: forget every entry. */
export function resetAutosaves(): void {
    for (const entry of entries.values()) {
        entry.autosave.stop();
        entry.source.unsubscribe();
    }
    entries.clear();
}
