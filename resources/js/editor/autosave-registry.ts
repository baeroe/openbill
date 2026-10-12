import { mutate } from 'swr';
import { saveDraft } from '@/api/documents';
import { keys } from '@/api/keys';
import { invalidate } from '@/api/paged';
import type { DocumentDetail } from '@/api/types';
import { ApiError, errorMessage, goToLogin, setUnauthenticatedHandler } from '@/lib/api';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Autosave } from './autosave';
import { draftSource, type DraftSource } from './draft-source';
import { fromDocument, samePayload, toPayload } from './ops';
import { fieldErrors } from './paths';
import { useEditor } from './store';
import type { DraftPayload } from './types';
import { stashDrafts, takeDraft } from './unsaved-drafts';

export type Save = (id: string, payload: DraftPayload) => Promise<DocumentDetail>;
/** users: editors holding the entry (never dropped while > 0); disposed: dropped for good, never handed out again. */
export type AutosaveEntry = { id: string; autosave: Autosave; source: DraftSource; users: number; disposed: boolean };

/** PATCH, then the answer becomes the cached document (what useSWRMutation's populateCache did). */
const patch: Save = async (id, payload) => {
    const saved = await saveDraft(id, payload);
    await mutate(keys.document(id), saved, { revalidate: false });
    return saved;
};

/**
 * At most one autosave per document, outliving its editor: leaving the page while a save or a retry is still running
 * and coming back takes over the same instance with its newest local state – no second instance, no older cached
 * state overwriting newer input. Taking and holding an entry is one step (acquireAutosave, in the editor's effect): an
 * entry with users is never dropped, a dropped entry is never handed out again (its store subscription is gone).
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
            // every save, also while the store still holds this document after leaving it (nobody resets the store on
            // the way to the list): a list that loaded meanwhile must not keep the older title, customer and totals
            void invalidate('/api/documents', [keys.document(id)]);
        },
        onState: (state, error, sent) => {
            // nobody holds the entry anymore and it is done (saved, or blocked for good): drop it
            if (entry.users === 0 && (state === 'saved' || state === 'locked' || state === 'gone')) queueMicrotask(() => dropIfIdle(entry));
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
    const entry: AutosaveEntry = { id, autosave, source, users: 0, disposed: false };
    return entry;
}

/** Drops an entry nobody holds once nothing is pending (or it can never save again). Disposed entries stay dead. */
function dropIfIdle(entry: AutosaveEntry): void {
    if (entry.disposed || entry.users > 0) return;
    const blocked = entry.autosave.stopped || entry.autosave.state === 'locked' || entry.autosave.state === 'gone';
    if (entry.autosave.pending && !blocked) return;
    entry.disposed = true;
    entry.source.unsubscribe();
    if (entries.get(entry.id) === entry) entries.delete(entry.id);
}

let listening = false;

/** Closing the tab: every document with unsaved input goes out with keepalive (also documents no editor shows). */
export function flushAllKeepalive(save: (id: string, payload: DraftPayload) => void = (id, payload) => void saveDraft(id, payload, { keepalive: true }).catch(() => undefined)): void {
    for (const entry of entries.values()) entry.autosave.flushKeepalive((payload) => save(entry.id, payload));
}

/**
 * The session is gone (401): the unsaved input of every open document goes to sessionStorage before the browser
 * leaves for the login. Opening the document again after logging in brings it back (showDocument).
 */
export function stashUnsavedDrafts(): void {
    const drafts: { id: string; payload: DraftPayload }[] = [];
    for (const entry of entries.values()) {
        if (!entry.autosave.pending || entry.autosave.stopped) continue;
        const payload = entry.source.payload();
        if (payload) drafts.push({ id: entry.id, payload });
    }
    stashDrafts(drafts);
}

/**
 * The editor of a document takes its autosave and holds it until releaseAutosave (one step, in the mount effect): the
 * running entry from an earlier visit, or a fresh one with a live store subscription.
 */
export function acquireAutosave(id: string, save: Save = patch): AutosaveEntry {
    let entry = entries.get(id);
    if (!entry || entry.disposed || entry.autosave.stopped) {
        if (entry) dropIfIdle(entry);
        entry = create(id, save);
        entries.set(id, entry);
    }
    entry.users++;
    if (!listening && typeof window !== 'undefined') {
        listening = true;
        window.addEventListener('pagehide', () => flushAllKeepalive());
        // 401 anywhere in the app: keep what is not saved, then the login (api.ts' default only does the latter)
        setUnauthenticatedHandler(() => {
            stashUnsavedDrafts();
            goToLogin();
        });
    }
    return entry;
}

/** The editor goes away: save what is open; the entry is dropped once that is on the server and nobody holds it. */
export function releaseAutosave(entry: AutosaveEntry): Promise<void> {
    entry.users = Math.max(0, entry.users - 1);
    const drop = () => dropIfIdle(entry);
    return entry.autosave.flush().then(drop, drop);
}

/**
 * Server state → store while the editor shows the document. Opening it (the store holds another document) shows the
 * server state – or, while this document's autosave still has unsaved input, that input on top of it. Later only a
 * changed lock or an external change while nothing is pending replaces the local state. Input kept from an expired
 * session (unsaved-drafts.ts) comes back the same way, with a message.
 */
export function showDocument(entry: AutosaveEntry, document: DocumentDetail): void {
    const { autosave, source } = entry;
    const store = useEditor.getState();
    if (store.draft === null || store.draft.id !== entry.id) {
        const local = autosave.pending && !autosave.stopped ? source.payload() : null;
        // input kept from before an expired session (stashed on 401): only into a document that is still a draft
        const kept = local === null ? takeDraft(entry.id) : null;
        const restored = kept !== null && !document.is_locked ? kept : null;
        const payload = local ?? restored;
        store.load(document, payload ? { payload, saveState: local ? autosave.state : 'dirty' } : undefined);
        if (payload) autosave.changed();
        else autosave.reset();
        if (restored) toast.info(t('editor.restored_after_login'));
        return;
    }
    const lockChanged = (store.draft.status !== 'draft') !== document.is_locked;
    const external = !autosave.pending && !samePayload(toPayload(fromDocument(document)), store.synced);
    if (lockChanged || external) {
        store.load(document);
        autosave.reset();
    }
}

/** Logout: one last attempt for every open document. Nothing is stopped – that happens only once the logout worked. */
export function flushAutosaves(): Promise<void> {
    return Promise.all([...entries.values()].map((entry) => entry.autosave.flush().catch(() => undefined))).then(() => undefined);
}

/** Logout (another person may sign in in this tab) and tests: stop and forget every entry, nothing is sent anymore. */
export function resetAutosaves(): void {
    for (const entry of entries.values()) {
        entry.autosave.stop();
        entry.disposed = true;
        entry.source.unsubscribe();
    }
    entries.clear();
}
