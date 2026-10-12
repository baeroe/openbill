import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentDetail } from '@/api/types';
import { ApiError } from '@/lib/api';
import { Autosave } from './autosave';
import { createSaveAnnouncer } from './save-announcement';
import type { DraftPayload } from './types';

const problem = (status: number, reason: string) => new ApiError({ type: `urn:openbill:problem:${reason}`, title: 'Title', status, detail: reason, reason });

/** An Autosave whose states go through the announcer, as in the editor header; the test answers every save. */
function setup() {
    let revision = 0;
    const calls: { resolve(answer: DocumentDetail): void; reject(error: unknown): void }[] = [];
    const states: string[] = [];
    const spoken: string[] = [];
    const announce = createSaveAnnouncer();
    const autosave = new Autosave({
        retryDelays: [2000],
        revision: () => revision,
        payload: () => ({ intro: String(revision) }) as unknown as DraftPayload,
        save: () => new Promise<DocumentDetail>((resolve, reject) => calls.push({ resolve, reject })),
        onSaved: () => undefined,
        onState: (state) => {
            states.push(state);
            const key = announce(state);
            if (key) spoken.push(key);
        },
    });
    const change = () => {
        revision++;
        autosave.changed();
    };
    return { calls, states, spoken, change };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createSaveAnnouncer with the real autosave sequence', () => {
    it('says nothing while typing and saving normally (dirty → saving → saved)', async () => {
        const { calls, states, spoken, change } = setup();
        change();
        await vi.advanceTimersByTimeAsync(600);
        calls[0].resolve({} as DocumentDetail);
        await vi.advanceTimersByTimeAsync(0);

        expect(states).toEqual(['dirty', 'saving', 'saved']);
        expect(spoken).toEqual([]);
    });

    it('announces a network error once, not after every retry, and "saved" once it works again (error → saving → saved)', async () => {
        const { calls, states, spoken, change } = setup();
        change();
        await vi.advanceTimersByTimeAsync(600);
        calls[0].reject(problem(0, 'network'));
        await vi.advanceTimersByTimeAsync(2000);
        calls[1].reject(problem(503, 'pdf_render_failed'));
        await vi.advanceTimersByTimeAsync(2000);
        calls[2].resolve({} as DocumentDetail);
        await vi.advanceTimersByTimeAsync(0);

        expect(states).toEqual(['dirty', 'saving', 'error', 'saving', 'error', 'saving', 'saved']);
        expect(spoken).toEqual(['editor.save.error', 'editor.save.saved']);
    });

    it('announces invalid input and "saved" after the corrected input went out (invalid → dirty → saving → saved)', async () => {
        const { calls, states, spoken, change } = setup();
        change();
        await vi.advanceTimersByTimeAsync(600);
        calls[0].reject(problem(422, 'validation_failed'));
        await vi.advanceTimersByTimeAsync(0);
        change();
        await vi.advanceTimersByTimeAsync(600);
        calls[1].resolve({} as DocumentDetail);
        await vi.advanceTimersByTimeAsync(0);

        expect(states).toEqual(['dirty', 'saving', 'invalid', 'dirty', 'saving', 'saved']);
        expect(spoken).toEqual(['editor.save.invalid', 'editor.save.saved']);
    });
});
