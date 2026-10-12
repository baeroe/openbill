import type { StoreApi } from 'zustand';
import { toPayload } from './ops';
import type { EditorState } from './store';
import type { DraftPayload } from './types';

export type DraftSource = { revision(): number; payload(): DraftPayload | null; unsubscribe(): void };

/**
 * What the autosave of one document reads. While the store holds the document: its live state. Once the store moved on
 * to another document (page change while a save is on its way, retries after an error), the last state seen of this
 * document – so the follow-up save still goes out with the newest input instead of silently dropping it.
 */
export function draftSource(store: Pick<StoreApi<EditorState>, 'getState' | 'subscribe'>, id: string): DraftSource {
    let revision = 0;
    let payload: DraftPayload | null = null;
    const take = (state: EditorState) => {
        if (state.draft?.id !== id) return;
        revision = state.revision;
        payload = state.draft.status === 'draft' ? toPayload(state.draft) : null;
    };
    take(store.getState());
    const unsubscribe = store.subscribe(take);
    return { revision: () => revision, payload: () => payload, unsubscribe };
}
