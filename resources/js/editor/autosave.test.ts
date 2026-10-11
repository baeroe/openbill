import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentDetail } from '@/api/types';
import { ApiError } from '@/lib/api';
import { Autosave } from './autosave';
import type { DraftPayload, SaveState } from './types';

type Call = { payload: DraftPayload; resolve(answer: DocumentDetail): void; reject(error: unknown): void };

function setup(retryDelays?: number[]) {
    let revision = 0;
    let payload = { intro: 'v0' } as unknown as DraftPayload;
    const calls: Call[] = [];
    const states: SaveState[] = [];
    const saved: [DraftPayload, DocumentDetail][] = [];
    const autosave = new Autosave({
        delay: 600,
        retryDelays,
        revision: () => revision,
        payload: () => payload,
        save: (sent) => new Promise<DocumentDetail>((resolve, reject) => calls.push({ payload: sent, resolve, reject })),
        onSaved: (sent, answer) => saved.push([sent, answer]),
        onState: (state) => states.push(state),
    });
    const change = (intro: string) => {
        revision++;
        payload = { intro } as unknown as DraftPayload;
        autosave.changed();
    };
    return { autosave, calls, states, saved, change };
}

const answer = (n: number) => ({ id: `answer-${n}` }) as unknown as DocumentDetail;
const problem = (status: number, reason: string) => new ApiError({ type: `urn:openbill:problem:${reason}`, title: 'Title', status, detail: reason, reason });
const intro = (call: Call) => (call.payload as unknown as { intro: string }).intro;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Autosave', () => {
    it('saves once, 600 ms after the last change, with the latest state', async () => {
        const { calls, states, change } = setup();

        change('a');
        await vi.advanceTimersByTimeAsync(300);
        change('ab');
        await vi.advanceTimersByTimeAsync(599);
        expect(calls).toHaveLength(0);
        await vi.advanceTimersByTimeAsync(1);

        expect(calls.map(intro)).toEqual(['ab']);
        expect(states).toEqual(['dirty', 'dirty', 'saving']);
    });

    it('saves a change made during a save right after it, exactly once (review focus)', async () => {
        const { calls, states, saved, change } = setup();

        change('a');
        await vi.advanceTimersByTimeAsync(600);
        change('ab');
        await vi.advanceTimersByTimeAsync(600);
        expect(calls).toHaveLength(1);

        calls[0].resolve(answer(1));
        await vi.advanceTimersByTimeAsync(0);
        expect(calls.map(intro)).toEqual(['a', 'ab']);
        expect(saved.map(([sent]) => (sent as unknown as { intro: string }).intro)).toEqual(['a']);

        calls[1].resolve(answer(2));
        await vi.advanceTimersByTimeAsync(0);
        expect(calls).toHaveLength(2);
        expect(states.at(-1)).toBe('saved');
    });

    it('does not retry invalid input until the next change', async () => {
        const { autosave, calls, change } = setup();
        change('a');
        await vi.advanceTimersByTimeAsync(600);

        calls[0].reject(problem(422, 'validation_failed'));
        await vi.advanceTimersByTimeAsync(60_000);
        expect(autosave.state).toBe('invalid');
        expect(calls).toHaveLength(1);

        change('b');
        await vi.advanceTimersByTimeAsync(600);
        expect(calls).toHaveLength(2);
    });

    it('stops for good when the document was finalized or deleted elsewhere (review focus)', async () => {
        for (const [error, state] of [
            [problem(409, 'document_locked'), 'locked'],
            [problem(404, 'not_found'), 'gone'],
        ] as const) {
            const { autosave, calls, change } = setup();
            change('a');
            await vi.advanceTimersByTimeAsync(600);
            calls[0].reject(error);
            await vi.advanceTimersByTimeAsync(0);

            change('b');
            await vi.advanceTimersByTimeAsync(60_000);
            await autosave.flush();

            expect(autosave.state).toBe(state);
            expect(calls).toHaveLength(1);
        }
    });

    it('treats other conflicts (cancellation customer) as invalid input', async () => {
        const { autosave, calls, change } = setup();
        change('a');
        await vi.advanceTimersByTimeAsync(600);
        calls[0].reject(problem(409, 'cancellation_customer'));
        await vi.advanceTimersByTimeAsync(0);

        expect(autosave.state).toBe('invalid');
    });

    it('retries network and server errors with growing pauses', async () => {
        const { autosave, calls, change } = setup([2000, 5000]);
        change('a');
        await vi.advanceTimersByTimeAsync(600);

        calls[0].reject(problem(0, 'network'));
        await vi.advanceTimersByTimeAsync(1999);
        expect(autosave.state).toBe('error');
        expect(calls).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(calls).toHaveLength(2);

        calls[1].reject(problem(503, 'pdf_render_failed'));
        await vi.advanceTimersByTimeAsync(4999);
        expect(calls).toHaveLength(2);
        await vi.advanceTimersByTimeAsync(1);
        expect(calls).toHaveLength(3);

        calls[2].resolve(answer(3));
        await vi.advanceTimersByTimeAsync(0);
        expect(autosave.state).toBe('saved');
    });

    it('retry() saves at once', async () => {
        const { autosave, calls, change } = setup([30_000]);
        change('a');
        await vi.advanceTimersByTimeAsync(600);
        calls[0].reject(problem(0, 'network'));
        await vi.advanceTimersByTimeAsync(0);

        void autosave.retry();
        expect(calls).toHaveLength(2);
    });

    it('flush() saves without waiting and resolves after the answer', async () => {
        const { autosave, calls, change } = setup();
        change('a');

        const done = autosave.flush();
        expect(calls).toHaveLength(1);
        calls[0].resolve(answer(1));
        await done;

        expect(autosave.state).toBe('saved');
        expect(autosave.pending).toBe(false);
        await expect(autosave.flush()).resolves.toBeUndefined();
        expect(calls).toHaveLength(1);
    });

    it('sends the unsaved state with keepalive when the tab closes, nothing when saved', async () => {
        const { autosave, calls, change } = setup();
        const sent: DraftPayload[] = [];

        autosave.flushKeepalive((payload) => sent.push(payload));
        expect(sent).toHaveLength(0);

        change('a');
        autosave.flushKeepalive((payload) => sent.push(payload));
        await vi.advanceTimersByTimeAsync(600);

        expect(sent).toHaveLength(1);
        expect(calls).toHaveLength(0);
    });

    it('reset() counts the current state as saved (after loading the server state)', async () => {
        const { autosave, calls, change } = setup();
        change('a');
        autosave.reset();
        await vi.advanceTimersByTimeAsync(600);

        expect(calls).toHaveLength(0);
        expect(autosave.state).toBe('saved');
    });

    it('saves nothing after stop() and ignores an answer that arrives later (deleted draft)', async () => {
        const { autosave, calls, saved, change } = setup();
        change('a');
        await vi.advanceTimersByTimeAsync(600);
        autosave.stop();
        calls[0].resolve(answer(1));
        change('b');
        await vi.advanceTimersByTimeAsync(600);
        await autosave.flush();

        expect(calls).toHaveLength(1);
        expect(saved).toHaveLength(0);
    });
});
