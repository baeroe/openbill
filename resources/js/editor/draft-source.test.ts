import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentDetail } from '@/api/types';
import { Autosave } from './autosave';
import { draftSource } from './draft-source';
import { useEditor } from './store';
import type { DraftPayload } from './types';

const detail = (id: string): DocumentDetail =>
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
        intro: '',
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
        open_amount: null,
        created_at: null,
        updated_at: null,
        groups: [],
        totals: null,
        issues: [],
        dropped_fields: [],
    }) satisfies DocumentDetail;

beforeEach(() => {
    vi.useFakeTimers();
    useEditor.getState().reset();
});
afterEach(() => vi.useRealTimers());

const type = (intro: string) => useEditor.getState().update((d) => ({ ...d, intro }));

describe('draftSource', () => {
    it('still saves the newest input of a document after the editor moved on to another one (review focus)', async () => {
        useEditor.getState().load(detail('a'));
        const source = draftSource(useEditor, 'a');
        const calls: { payload: DraftPayload; resolve(answer: DocumentDetail): void }[] = [];
        const autosave = new Autosave({
            revision: source.revision,
            payload: source.payload,
            save: (payload) => new Promise((resolve) => calls.push({ payload, resolve })),
            onSaved: () => undefined,
            onState: () => undefined,
        });

        type('Hallo');
        void autosave.flush();
        type('Hallo Jana'); // typed while the first save is on its way …
        const leaving = autosave.flush(); // … then the page changes (router 'before' / unmount)
        useEditor.getState().load(detail('b'));

        calls[0].resolve(detail('a'));
        await vi.advanceTimersByTimeAsync(0);

        expect(calls.map((call) => call.payload.intro)).toEqual(['Hallo', 'Hallo Jana']);
        calls[1].resolve(detail('a'));
        await leaving;
        expect(autosave.pending).toBe(false);
        source.unsubscribe();
    });

    it('does not count changes of the other document as unsaved changes of this one', () => {
        useEditor.getState().load(detail('a'));
        const source = draftSource(useEditor, 'a');
        const before = source.revision();

        useEditor.getState().load(detail('b'));
        type('nur in B');

        expect(source.revision()).toBe(before);
        expect(source.payload()?.intro).toBe('');
        source.unsubscribe();
    });
});
