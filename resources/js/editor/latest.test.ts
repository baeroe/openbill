import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';
import { createLatest, isAbort } from './latest';

/** A request that waits until it is resolved or its signal aborts (like fetch). */
function controllable() {
    const pending: { arg: string; signal: AbortSignal; resolve(value: string): void }[] = [];
    const run = (arg: string, signal: AbortSignal) =>
        new Promise<string>((resolve, reject) => {
            pending.push({ arg, signal, resolve });
            signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
    return { pending, run };
}

describe('createLatest', () => {
    it('aborts the request still running when a newer one starts (review focus)', async () => {
        const { pending, run } = controllable();
        const latest = createLatest(run);

        const first = latest('slow');
        const second = latest('fast');

        expect(pending[0].signal.aborted).toBe(true);
        await expect(first).rejects.toSatisfy(isAbort);
        pending[1].resolve('fast answer');
        await expect(second).resolves.toBe('fast answer');
    });

    it('does not abort the next request when an earlier one finishes', async () => {
        const { pending, run } = controllable();
        const latest = createLatest(run);

        const first = latest('a');
        pending[0].resolve('a');
        await first;
        void latest('b');

        expect(pending[1].signal.aborted).toBe(false);
    });
});

describe('isAbort', () => {
    it('recognizes aborted requests only', () => {
        expect(isAbort(new DOMException('Aborted', 'AbortError'))).toBe(true);
        expect(isAbort(new ApiError({ type: '', title: '', status: 0, detail: '', reason: 'network' }))).toBe(false);
        expect(isAbort(null)).toBe(false);
    });
});
