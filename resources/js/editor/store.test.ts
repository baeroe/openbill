import { beforeEach, describe, expect, it } from 'vitest';
import type { DocumentDetail } from '@/api/types';
import { useEditor } from './store';

const detail = (overrides: Partial<DocumentDetail> = {}): DocumentDetail => ({
    id: 'doc',
    type: 'invoice',
    status: 'draft',
    number: null,
    date: '2026-10-11',
    customer_id: 'cust',
    customer_name: 'Hotel Alpenglück',
    contact_id: null,
    service_date: '2026-10-11',
    service_date_end: null,
    due_date: '2026-10-25',
    valid_until: null,
    intro: '',
    closing: '',
    template_id: 'tpl',
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
    groups: [{ id: 'g1', title: 'Konzept', positions: [] }],
    totals: null,
    issues: [],
    dropped_fields: [],
    ...overrides,
});

const state = () => useEditor.getState();

beforeEach(() => state().reset());

describe('editor store', () => {
    it('loads a document and counts local changes', () => {
        state().load(detail());
        const loaded = state().revision;

        state().update((d) => ({ ...d, intro: 'Hallo' }));

        expect(state().draft?.intro).toBe('Hallo');
        expect(state().revision).toBe(loaded + 1);
        expect(state().synced?.intro).toBe('');
    });

    it('ignores changes that change nothing, of finalized documents and after a conflict', () => {
        state().load(detail());
        const loaded = state().revision;
        state().update((d) => d);
        expect(state().revision).toBe(loaded);

        state().load(detail({ status: 'open', is_locked: true }));
        state().update((d) => ({ ...d, intro: 'x' }));
        expect(state().draft?.intro).toBe('');

        state().load(detail());
        state().setSave('locked');
        state().update((d) => ({ ...d, intro: 'x' }));
        expect(state().draft?.intro).toBe('');
    });

    it('keeps a conflict when the same document loads again, forgets it for another one', () => {
        state().load(detail());
        state().setSave('locked');
        state().load(detail({ status: 'open', is_locked: true }));
        expect(state().saveState).toBe('locked');

        state().load(detail({ id: 'other' }));
        expect(state().saveState).toBe('saved');
    });

    it('takes over server ids, the saved state and collapsed groups after a save', () => {
        state().load(detail({ groups: [] }));
        state().update((d) => ({ ...d, groups: [{ id: 'local-g', title: 'Neu', positions: [] }] }));
        state().toggleGroup('local-g');
        state().setErrors({ 'document.date': 'Date is missing.' });
        const sent = { ...state().draft!, groups: state().draft!.groups };

        state().applySaved(sent, detail({ groups: [{ id: '01G', title: 'Neu', positions: [] }] }));

        expect(state().draft?.groups[0].id).toBe('01G');
        expect(state().aliases).toEqual({ '01G': 'local-g' });
        expect(state().collapsed).toEqual(['01G']);
        expect(state().errors).toEqual({});
        expect(state().synced?.groups[0].id).toBe('01G');
    });

    it('collapses and expands groups', () => {
        state().toggleGroup('g1');
        expect(state().collapsed).toEqual(['g1']);
        state().toggleGroup('g1');
        expect(state().collapsed).toEqual([]);
        state().toggleGroup('g1');
        state().expandAll();
        expect(state().collapsed).toEqual([]);
    });
});
