import type { DraftPayload } from './types';

/**
 * Unsaved input of drafts whose session ended (401): kept in sessionStorage (this tab only) while the browser goes to
 * the login, and loaded again when the same person opens the document after logging in. Never handed to anyone else,
 * dropped after a day and on logout.
 */
const PREFIX = 'openbill:unsaved:';
/** Older input is more likely to confuse than to help. */
export const UNSAVED_MAX_AGE = 24 * 60 * 60 * 1000;

type Stash = { user: string; at: number; payload: DraftPayload };

let owner: string | null = null;

function storage(): Storage | null {
    try {
        return typeof sessionStorage === 'undefined' ? null : sessionStorage;
    } catch {
        return null; // storage blocked by privacy settings throws on access
    }
}

/**
 * The signed-in person (Inertia's auth.user.id): input is kept and handed out for them only. Whatever another person
 * left in this tab (a 401, then someone else logs in) and whatever is older than a day is removed right away.
 */
export function setDraftOwner(id: string | null): void {
    owner = id;
    if (id !== null) prune((stash) => stash?.user !== id || typeof stash.at !== 'number' || Date.now() - stash.at > UNSAVED_MAX_AGE);
}

/** Removes the kept input for which `drop` says so (unreadable entries count as null). */
function prune(drop: (stash: Partial<Stash> | null) => boolean): void {
    const store = storage();
    if (!store) return;
    try {
        const keys: string[] = [];
        for (let i = 0; i < store.length; i++) {
            const key = store.key(i);
            if (!key?.startsWith(PREFIX)) continue;
            let stash: Partial<Stash> | null = null;
            try {
                stash = JSON.parse(store.getItem(key) ?? 'null') as Partial<Stash> | null;
            } catch {
                // unreadable: dropped like a foreign one
            }
            if (drop(stash)) keys.push(key);
        }
        keys.forEach((key) => store.removeItem(key));
    } catch {
        // nothing to clear
    }
}

export function stashDrafts(drafts: { id: string; payload: DraftPayload }[]): void {
    const store = storage();
    if (!store || owner === null) return;
    for (const { id, payload } of drafts) {
        try {
            store.setItem(PREFIX + id, JSON.stringify({ user: owner, at: Date.now(), payload } satisfies Stash));
        } catch {
            // quota or blocked storage: the input is lost as before, nothing else breaks
        }
    }
}

/** The kept input of one document for the current person, removed on reading; null if none, too old or someone else's. */
export function takeDraft(id: string): DraftPayload | null {
    const store = storage();
    if (!store) return null;
    let raw: string | null;
    try {
        raw = store.getItem(PREFIX + id);
        store.removeItem(PREFIX + id);
    } catch {
        return null;
    }
    if (raw === null || owner === null) return null;
    try {
        const stash = JSON.parse(raw) as Partial<Stash>;
        if (stash.user !== owner || typeof stash.at !== 'number' || Date.now() - stash.at > UNSAVED_MAX_AGE || !stash.payload) return null;
        return stash.payload;
    } catch {
        return null;
    }
}

/** Logout: nothing of this person stays in the tab. */
export function clearDrafts(): void {
    prune(() => true);
}
