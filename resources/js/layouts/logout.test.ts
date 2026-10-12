import { mutate, SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentDetail } from '@/api/types';
import { acquireAutosave, resetAutosaves, showDocument } from '@/editor/autosave-registry';
import { useEditor } from '@/editor/store';
import type { DraftPayload } from '@/editor/types';
import { setDraftOwner, stashDrafts } from '@/editor/unsaved-drafts';
import { commitAllKeepalive, pendingDeleteIds, scheduleDelete } from '@/lib/pending-delete';
import { currentToasts, dismissToast } from '@/lib/toast';
import { memoryStorage } from '@/test-utils/memory-storage';
import { LOGOUT_POST_TIMEOUT, LOGOUT_SAVE_WAIT, logout } from './logout';

const detail = (id: string, intro = ''): DocumentDetail =>
    ({
        id,
        type: 'invoice',
        status: 'draft',
        number: null,
        date: '2026-10-11',
        customer_id: null,
        customer_name: null,
        contact_id: null,
        service_date: null,
        service_date_end: null,
        due_date: null,
        valid_until: null,
        intro,
        closing: '',
        template_id: null,
        locale: 'de',
        custom: {},
        source_id: null,
        cancelled_by_id: null,
        is_locked: false,
        is_overdue: false,
        finalized_at: null,
        paid_at: null,
        net_total: '0.00',
        tax_total: '0.00',
        gross_total: '0.00',
        created_at: null,
        updated_at: null,
        groups: [],
        totals: null,
        issues: [],
        dropped_fields: [],
    }) satisfies DocumentDetail;

type Call = { intro: string; resolve(answer: DocumentDetail): void };
let calls: Call[];
const save = (_id: string, payload: DraftPayload) => new Promise<DocumentDetail>((resolve) => calls.push({ intro: payload.intro, resolve }));

/** The editor of A with unsaved input "Hallo". */
function editing() {
    const entry = acquireAutosave('a', save);
    showDocument(entry, detail('a'));
    const type = (intro: string) => {
        useEditor.getState().update((d) => ({ ...d, intro }));
        entry.autosave.changed();
    };
    type('Hallo');
    return { entry, type };
}

const cache = SWRConfig.defaultValue.cache;

beforeEach(() => {
    vi.useFakeTimers();
    calls = [];
    resetAutosaves();
    useEditor.getState().reset();
    for (const key of [...cache.keys()]) cache.delete(key);
    for (const toast of currentToasts()) dismissToast(toast.id);
});
afterEach(() => {
    commitAllKeepalive();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('logout', () => {
    it('saves what is open, ends the session, then forgets autosaves, the draft and every cached answer', async () => {
        const { entry } = editing();
        const order: string[] = [];
        const done = logout({ post: async () => void order.push(`post, stopped: ${entry.autosave.stopped}`), leave: () => order.push('leave') });
        expect(calls.map((call) => call.intro)).toEqual(['Hallo']); // the last save goes out first …
        calls[0].resolve(detail('a', 'Hallo'));

        expect(await done).toBe(true);
        expect(order).toEqual(['post, stopped: false', 'leave']); // … nothing is stopped before the session ended
        expect(entry.autosave.stopped).toBe(true);
        expect(useEditor.getState().draft).toBeNull();
    });

    it('also clears the cached pages of the paginated lists, which a filter-mutate skips (rereview 3)', async () => {
        await mutate('/api/documents/a', detail('a'), { revalidate: false });
        // what useSWRInfinite keeps for the document list of the person logging out
        cache.set('$inf$/api/documents?page=1&itemsPerPage=50', { data: [{ items: [{ id: 'a' }], total: 1, page: 1, hasMore: false }] });
        expect([...cache.keys()]).toHaveLength(2);

        expect(await logout({ post: async () => undefined, leave: () => undefined })).toBe(true);

        expect([...cache.keys()]).toEqual([]);
    });

    it('a failed logout keeps the editor saving, keeps its draft and says so (rereview 3)', async () => {
        const { entry, type } = editing();
        const leave = vi.fn();
        const done = logout({
            post: () => Promise.reject(new Error('offline')),
            leave,
        });
        calls[0].resolve(detail('a', 'Hallo'));

        expect(await done).toBe(false);
        expect(leave).not.toHaveBeenCalled();
        expect(currentToasts().map((toast) => [toast.tone, toast.message])).toEqual([['error', 'user_menu.logout_failed']]);
        expect(entry.autosave.stopped).toBe(false);
        expect(useEditor.getState().draft?.intro).toBe('Hallo');

        type('Hallo Jana'); // still editable, and still saved
        await vi.advanceTimersByTimeAsync(600);
        expect(calls.map((call) => call.intro)).toEqual(['Hallo', 'Hallo Jana']);
    });

    it('waits at most 3 s for a hanging save, then logs out anyway (rereview 3)', async () => {
        editing();
        const post = vi.fn(async () => undefined);
        const done = logout({ post, leave: () => undefined });
        expect(calls).toHaveLength(1); // this save never answers

        await vi.advanceTimersByTimeAsync(LOGOUT_SAVE_WAIT - 1);
        expect(post).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);

        expect(await done).toBe(true);
        expect(post).toHaveBeenCalledOnce();
        expect(LOGOUT_SAVE_WAIT).toBe(3000);
    });

    it('says that it is logging out while it waits (ledger phase 6)', async () => {
        editing();
        const done = logout({ post: async () => undefined, leave: () => undefined });
        expect(currentToasts().map((toast) => [toast.tone, toast.message])).toEqual([['neutral', 'user_menu.logging_out']]);
        calls[0].resolve(detail('a', 'Hallo'));
        expect(await done).toBe(true);
    });

    it('sends deletes still waiting for their undo toast before it ends the session (ledger phase 6)', async () => {
        const order: string[] = [];
        scheduleDelete('d1', async ({ keepalive }) => void order.push(`delete d1, keepalive: ${keepalive}`));

        expect(await logout({ post: async () => void order.push('post'), leave: () => undefined })).toBe(true);
        expect(order).toEqual(['delete d1, keepalive: false', 'post']);
        expect(pendingDeleteIds().size).toBe(0);
    });

    it.each([
        [[401], 1],
        [[419, 204, 401], 3], // CSRF token changed: fresh token, then the session turns out to be over
        [[419, 204, 204], 3], // CSRF token changed, session still valid: logged out on the second try (review phase 11)
    ])('counts the answers %j on logout as logged out: cleans up and leaves (ledger phase 6)', async (statuses, fetches) => {
        const answers = [...statuses];
        const fetch = vi.fn(async () => new Response(null, { status: answers.shift() }));
        vi.stubGlobal('fetch', fetch);
        const { entry } = editing();
        const leave = vi.fn();
        const done = logout({ leave });
        calls[0].resolve(detail('a', 'Hallo'));

        expect(await done).toBe(true);
        expect(fetch).toHaveBeenCalledTimes(fetches);
        expect(leave).toHaveBeenCalledOnce();
        expect(entry.autosave.stopped).toBe(true);
    });

    it('fails when the CSRF token is refused even after renewing it (review phase 11)', async () => {
        const answers = [419, 204, 419];
        vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: answers.shift() })));
        const leave = vi.fn();

        expect(await logout({ leave })).toBe(false);
        expect(leave).not.toHaveBeenCalled();
    });

    it('still fails on a server error of the logout', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })));
        const leave = vi.fn();

        expect(await logout({ leave })).toBe(false);
        expect(leave).not.toHaveBeenCalled();
    });

    it('gives up on a logout request that hangs for 10 s and says so (ledger phase 6)', async () => {
        const post = vi.fn((signal: AbortSignal) => new Promise<void>((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))));
        const leave = vi.fn();
        const done = logout({ post, leave });
        let settled = false;
        void done.then(() => (settled = true));

        await vi.advanceTimersByTimeAsync(LOGOUT_POST_TIMEOUT - 1);
        expect(post).toHaveBeenCalledOnce();
        expect(settled).toBe(false);
        await vi.advanceTimersByTimeAsync(1);

        expect(await done).toBe(false);
        expect(leave).not.toHaveBeenCalled();
        expect(currentToasts().map((toast) => [toast.tone, toast.message])).toEqual([['error', 'user_menu.logout_failed']]);
        expect(LOGOUT_POST_TIMEOUT).toBe(10000);
    });

    it('forgets input kept from an expired session (the next person in this tab must not get it)', async () => {
        vi.stubGlobal('sessionStorage', memoryStorage());
        setDraftOwner('u1');
        stashDrafts([{ id: 'a', payload: { intro: 'Hallo' } as unknown as DraftPayload }]);

        expect(await logout({ post: async () => undefined, leave: () => undefined })).toBe(true);
        expect(sessionStorage.length).toBe(0);
    });
});
