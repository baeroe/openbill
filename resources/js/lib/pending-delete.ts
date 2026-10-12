import { useSyncExternalStore } from 'react';

export type DeleteRun = (options: { keepalive: boolean }) => Promise<void>;
type Entry = { run: DeleteRun; committing: boolean };

const entries = new Map<string, Entry>();
let snapshot: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function emit(): void {
    snapshot = new Set(entries.keys());
    listeners.forEach((listener) => listener());
}

/** Closing the tab: every delete still waiting for its toast goes out with keepalive. */
export function commitAllKeepalive(): void {
    for (const [id, entry] of entries) {
        if (entry.committing) continue;
        entry.committing = true;
        entries.delete(id);
        void entry.run({ keepalive: true }).catch(() => undefined);
    }
    emit();
}

/**
 * Logout: every delete still waiting for its toast goes out now – without keepalive, the page waits for the answers
 * (the logout caps that wait). The toasts' own commit() finds nothing left to do afterwards.
 */
export function flushPendingDeletes(): Promise<void> {
    const runs: Promise<void>[] = [];
    for (const [id, entry] of entries) {
        if (entry.committing) continue;
        entry.committing = true;
        entries.delete(id);
        runs.push(entry.run({ keepalive: false }).catch(() => undefined));
    }
    emit();
    return Promise.all(runs).then(() => undefined);
}

let listening = false;

function listen(): void {
    if (listening || typeof window === 'undefined') return;
    listening = true;
    window.addEventListener('pagehide', commitAllKeepalive);
}

/**
 * Delete with undo (the API deletes drafts for good): the draft disappears from the lists at once, DELETE runs on
 * commit() – when the undo toast closed without undo. undo() keeps the draft as long as the delete has not started.
 */
export function scheduleDelete(id: string, run: DeleteRun): { undo(): boolean; commit(): Promise<void> } {
    const entry: Entry = { run, committing: false };
    entries.set(id, entry);
    listen();
    emit();

    return {
        undo: () => {
            if (entries.get(id) !== entry || entry.committing) return false;
            entries.delete(id);
            emit();
            return true;
        },
        commit: async () => {
            if (entries.get(id) !== entry || entry.committing) return;
            entry.committing = true;
            try {
                await run({ keepalive: false });
            } finally {
                if (entries.get(id) === entry) entries.delete(id);
                emit();
            }
        },
    };
}

export function pendingDeleteIds(): ReadonlySet<string> {
    return snapshot;
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function usePendingDeletes(): ReadonlySet<string> {
    return useSyncExternalStore(subscribe, pendingDeleteIds, pendingDeleteIds);
}
