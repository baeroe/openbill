import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from '@/test-utils/memory-storage';
import type { DraftPayload } from './types';
import { clearDrafts, setDraftOwner, stashDrafts, takeDraft, UNSAVED_MAX_AGE } from './unsaved-drafts';

const payload = (intro: string) => ({ intro }) as unknown as DraftPayload;

beforeEach(() => {
    vi.stubGlobal('sessionStorage', memoryStorage());
    setDraftOwner('u1');
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('unsaved drafts', () => {
    it('keeps the input of a draft for the same person and hands it out once', () => {
        stashDrafts([{ id: 'a', payload: payload('Hallo Jana') }]);

        expect(takeDraft('a')?.intro).toBe('Hallo Jana');
        expect(takeDraft('a')).toBeNull();
    });

    it("never hands one person's input to another (same tab, shared computer)", () => {
        stashDrafts([{ id: 'a', payload: payload('Hallo Jana') }]);
        setDraftOwner('u2');
        expect(takeDraft('a')).toBeNull();
        setDraftOwner('u1');
        expect(takeDraft('a')).toBeNull(); // gone once the other person opened the document
    });

    it('drops input older than a day', () => {
        vi.useFakeTimers();
        stashDrafts([{ id: 'a', payload: payload('alt') }]);
        vi.advanceTimersByTime(UNSAVED_MAX_AGE + 1);

        expect(takeDraft('a')).toBeNull();
    });

    it('forgets everything on logout and keeps nothing without a signed-in person', () => {
        stashDrafts([
            { id: 'a', payload: payload('x') },
            { id: 'b', payload: payload('y') },
        ]);
        sessionStorage.setItem('something:else', 'stays');
        clearDrafts();
        expect(sessionStorage.length).toBe(1);

        setDraftOwner(null);
        stashDrafts([{ id: 'c', payload: payload('z') }]);
        expect(sessionStorage.length).toBe(1);
    });

    it('survives a storage that throws (blocked by privacy settings)', () => {
        const blocked = () => {
            throw new Error('blocked');
        };
        vi.stubGlobal('sessionStorage', { getItem: blocked, setItem: blocked, removeItem: blocked, key: () => null, length: 0, clear: blocked });

        expect(() => stashDrafts([{ id: 'a', payload: payload('x') }])).not.toThrow();
        expect(takeDraft('a')).toBeNull();
        expect(() => clearDrafts()).not.toThrow();
    });

    it("removes another person's kept input and input older than a day as soon as someone signs in (review phase 11)", () => {
        vi.useFakeTimers();
        stashDrafts([{ id: 'old', payload: payload('alt') }]);
        vi.advanceTimersByTime(UNSAVED_MAX_AGE + 1);
        stashDrafts([{ id: 'a', payload: payload('Hallo Jana') }]);
        setDraftOwner('u1'); // the same person again: only the old input goes
        expect(sessionStorage.length).toBe(1);

        setDraftOwner('u2'); // someone else signs in in this tab
        expect(sessionStorage.length).toBe(0);
    });
});
