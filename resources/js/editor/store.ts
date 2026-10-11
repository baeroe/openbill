import { create } from 'zustand';
import type { DocumentDetail } from '@/api/types';
import { fromDocument, idMap, reconcileIds, toPayload } from './ops';
import type { Draft, DraftPayload, SaveState } from './types';

export type EditorState = {
    draft: Draft | null;
    /** +1 on every local change (and on load); autosave compares it with the last saved revision. */
    revision: number;
    /** Last server state seen (GET or PATCH answer): tells external changes from own ones. */
    synced: DraftPayload | null;
    saveState: SaveState;
    saveError: unknown;
    /** data-path → message of the last refused save (422). */
    errors: Record<string, string>;
    collapsed: string[];
    /** Server id → the local id it replaced: stable React keys, so a row keeps focus and input state across a save. */
    aliases: Record<string, string>;
    load(document: DocumentDetail): void;
    update(fn: (draft: Draft) => Draft): void;
    /** update() only while this document is still in the editor: undo toasts outlive a page change. */
    updateFor(documentId: string, fn: (draft: Draft) => Draft): void;
    applySaved(sent: DraftPayload, saved: DocumentDetail): void;
    setSave(state: SaveState, error?: unknown): void;
    setErrors(errors: Record<string, string>): void;
    toggleGroup(id: string): void;
    expandAll(): void;
    reset(): void;
};

type Data = Pick<EditorState, 'draft' | 'revision' | 'synced' | 'saveState' | 'saveError' | 'errors' | 'collapsed' | 'aliases'>;

const initial = (): Data => ({ draft: null, revision: 0, synced: null, saveState: 'saved', saveError: null, errors: {}, collapsed: [], aliases: {} });

/** Local state of the document editor (spec 2: Zustand only for the editor). Changes go through the pure functions in ops.ts. */
export const useEditor = create<EditorState>()((set, get) => ({
    ...initial(),

    load: (document) =>
        set((state) => {
            const same = state.draft?.id === document.id;
            const draft = fromDocument(document);
            const conflict = same && (state.saveState === 'locked' || state.saveState === 'gone');
            return {
                draft,
                synced: toPayload(draft),
                revision: state.revision + 1,
                saveState: conflict ? state.saveState : 'saved',
                saveError: conflict ? state.saveError : null,
                errors: {},
                collapsed: same ? state.collapsed : [],
                aliases: same ? state.aliases : {},
            };
        }),

    update: (fn) => {
        const { draft, saveState } = get();
        if (!draft || draft.status !== 'draft' || saveState === 'locked' || saveState === 'gone') return;
        const next = fn(draft);
        if (next !== draft) set((state) => ({ draft: next, revision: state.revision + 1 }));
    },

    updateFor: (documentId, fn) => {
        if (get().draft?.id === documentId) get().update(fn);
    },

    applySaved: (sent, saved) =>
        set((state) => {
            const map = idMap(sent, saved.groups);
            return {
                draft: state.draft ? reconcileIds(state.draft, map) : null,
                synced: toPayload(fromDocument(saved)),
                collapsed: state.collapsed.map((id) => map[id] ?? id),
                aliases: { ...state.aliases, ...Object.fromEntries(Object.entries(map).map(([local, server]) => [server, state.aliases[local] ?? local])) },
                errors: {},
            };
        }),

    setSave: (saveState, error = null) => set({ saveState, saveError: error }),
    setErrors: (errors) => set({ errors }),
    toggleGroup: (id) => set((state) => ({ collapsed: state.collapsed.includes(id) ? state.collapsed.filter((x) => x !== id) : [...state.collapsed, id] })),
    expandAll: () => set({ collapsed: [] }),
    reset: () => set(initial()),
}));
