import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentDetail } from '@/api/types';
import { acquireAutosave, flushAllKeepalive, releaseAutosave, resetAutosaves, showDocument } from './autosave-registry';
import { useEditor } from './store';
import type { DraftPayload } from './types';

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

type Call = { id: string; intro: string; resolve(answer: DocumentDetail): void; reject(error: unknown): void };

let calls: Call[];
const save = (id: string, payload: DraftPayload) =>
    new Promise<DocumentDetail>((resolve, reject) => calls.push({ id, intro: payload.intro, resolve: (answer) => resolve(answer), reject }));

/** What the editor does: open the document (useAutosave), type (store update + changed()), leave (release). */
function open(id: string, cached: DocumentDetail) {
    const entry = acquireAutosave(id, save); // the editor's mount effect
    showDocument(entry, cached);
    const type = (intro: string) => {
        useEditor.getState().update((d) => ({ ...d, intro }));
        entry.autosave.changed();
    };
    return { entry, type, leave: () => releaseAutosave(entry) };
}

beforeEach(() => {
    vi.useFakeTimers();
    calls = [];
    resetAutosaves();
    useEditor.getState().reset();
});
afterEach(() => vi.useRealTimers());

describe('autosave registry', () => {
    it('A → B → back to A while A is still saving: the newest input of A is shown and saved, never the older cache (review)', async () => {
        const a = open('a', detail('a'));
        a.type('Hallo');
        await vi.advanceTimersByTimeAsync(600); // save 1 of A is on its way …
        a.type('Hallo Jana');
        void a.leave(); // … the user leaves A …
        open('b', detail('b')).leave();

        // … and comes back while save 1 still runs; the SWR cache still holds the state before it
        const back = open('a', detail('a', ''));
        expect(back.entry).toBe(a.entry); // the same instance, not a second autosave for A
        expect(useEditor.getState().draft?.intro).toBe('Hallo Jana');
        back.type('Hallo Jana, wie besprochen');

        calls[0].resolve(detail('a', 'Hallo'));
        await vi.advanceTimersByTimeAsync(0);
        await vi.advanceTimersByTimeAsync(600);

        expect(calls.filter((call) => call.id === 'a').map((call) => call.intro)).toEqual(['Hallo', 'Hallo Jana, wie besprochen']);
        calls[1].resolve(detail('a', 'Hallo Jana, wie besprochen'));
        await vi.advanceTimersByTimeAsync(0);
        expect(useEditor.getState().draft?.intro).toBe('Hallo Jana, wie besprochen');
        expect(useEditor.getState().saveState).toBe('saved');
    });

    it('back to A while A waits for a retry: the retry sends the newest input', async () => {
        const a = open('a', detail('a'));
        a.type('Hallo');
        await vi.advanceTimersByTimeAsync(600);
        calls[0].reject(new Error('offline'));
        await vi.advanceTimersByTimeAsync(0);
        void a.leave();
        open('b', detail('b')).leave();

        // leaving retried at once; that retry fails as well and waits for the next attempt
        expect(calls.map((call) => call.intro)).toEqual(['Hallo', 'Hallo']);
        calls[1].reject(new Error('still offline'));
        await vi.advanceTimersByTimeAsync(0);

        const back = open('a', detail('a', ''));
        expect(useEditor.getState().draft?.intro).toBe('Hallo');
        // unsaved input is back on screen: saved again 600 ms after opening instead of waiting out the retry pause
        expect(useEditor.getState().saveState).toBe('dirty');
        back.type('Hallo Jana');
        await vi.advanceTimersByTimeAsync(600);

        expect(calls.map((call) => call.intro)).toEqual(['Hallo', 'Hallo', 'Hallo Jana']);
    });

    it('closing the tab sends the unsaved input of a document no editor shows anymore, with keepalive', async () => {
        const a = open('a', detail('a'));
        a.type('Hallo');
        await vi.advanceTimersByTimeAsync(600);
        a.type('Hallo Jana');
        void a.leave();
        open('b', detail('b'));

        const sent: [string, string][] = [];
        flushAllKeepalive((id, payload) => sent.push([id, payload.intro]));
        expect(sent).toEqual([['a', 'Hallo Jana']]);
    });

    it('drops the entry once everything is saved and no editor uses it', async () => {
        const a = open('a', detail('a'));
        a.type('Hallo');
        const left = a.leave();
        calls[0].resolve(detail('a', 'Hallo'));
        await left;

        expect(a.entry.disposed).toBe(true);
        expect(acquireAutosave('a', save)).not.toBe(a.entry);
    });

    it('N2: a save answer arriving while the editor of A mounts again leaves a live entry, input keeps being saved (review)', async () => {
        const a = open('a', detail('a'));
        a.type('Hallo');
        await vi.advanceTimersByTimeAsync(600);
        const left = a.leave(); // leaving A while save 1 runs
        open('b', detail('b')).leave();
        // back to A: React renders the editor (nothing is taken during render) …
        calls[0].resolve(detail('a', 'Hallo')); // … save 1 answers before the mount effect ran …
        await left; // … and the finished entry is dropped
        expect(a.entry.disposed).toBe(true);

        const back = open('a', detail('a', 'Hallo')); // the mount effect takes a fresh entry
        expect(back.entry).not.toBe(a.entry);
        back.type('Hallo Jana');
        await vi.advanceTimersByTimeAsync(5000);

        expect(calls.map((call) => call.intro)).toEqual(['Hallo', 'Hallo Jana']);
    });

    it('never drops an entry an editor holds, and never hands out a dropped one', async () => {
        const first = acquireAutosave('a', save);
        const second = acquireAutosave('a', save); // StrictMode's second mount, or a second editor
        expect(second).toBe(first);
        await releaseAutosave(first);
        expect(first.disposed).toBe(false);
        await releaseAutosave(first);
        expect(first.disposed).toBe(true);
        expect(acquireAutosave('a', save)).not.toBe(first);
    });

    it('drops an entry left with a pending retry once that retry saved', async () => {
        const a = open('a', detail('a'));
        a.type('Hallo');
        await vi.advanceTimersByTimeAsync(600);
        calls[0].reject(new Error('offline'));
        await vi.advanceTimersByTimeAsync(0);
        const left = a.leave(); // leaving retries at once …
        calls[1].reject(new Error('still offline')); // … and fails again
        await left;
        expect(a.entry.disposed).toBe(false);

        await vi.advanceTimersByTimeAsync(5000); // second failure: the next pause is 5 s
        calls[2].resolve(detail('a', 'Hallo'));
        await vi.advanceTimersByTimeAsync(0);
        expect(a.entry.disposed).toBe(true);
    });
});
