import { describe, expect, it } from 'vitest';
import type { ApiGroup, ApiPosition, DocumentDetail } from '@/api/types';
import * as ops from './ops';
import type { Draft } from './types';

const position = (id: string, title = id, extra: Partial<ApiPosition> = {}): ApiPosition => ({
    id,
    kind: 'item',
    title,
    description: '',
    quantity: '1',
    unit_id: 'unit-h',
    unit_price: '100',
    tax_rate_id: 'rate-19',
    custom: {},
    ...extra,
});

const group = (id: string, title: string | null, positions: ApiPosition[]): ApiGroup => ({ id, title, positions });

const draft = (groups: ApiGroup[]): Draft => ({
    id: 'doc',
    type: 'offer',
    status: 'draft',
    date: '2026-10-11',
    customer_id: 'cust',
    contact_id: null,
    service_date: null,
    service_date_end: null,
    due_date: null,
    valid_until: '2026-10-25',
    intro: '',
    closing: '',
    template_id: 'tpl',
    locale: 'de',
    custom: { project_name: 'Relaunch' },
    groups,
});

const ids = (d: Draft) => d.groups.map((g) => `${g.id}:${g.positions.map((p) => p.id).join(',')}`);
const defaults = { unitId: 'unit-h', taxRateId: 'rate-19', custom: { ticket: null } };

describe('ids', () => {
    it('marks local ids', () => {
        const id = ops.localId();
        expect(id.startsWith(ops.LOCAL_PREFIX)).toBe(true);
        expect(ops.isLocalId(id)).toBe(true);
        expect(ops.isLocalId('01k9xyz')).toBe(false);
    });
});

describe('newPosition', () => {
    it('prices items with the defaults and leaves text lines empty', () => {
        const item = ops.newPosition('item', defaults);
        const text = ops.newPosition('text', defaults);

        expect(item).toMatchObject({ kind: 'item', quantity: '1', unit_price: '0', unit_id: 'unit-h', tax_rate_id: 'rate-19', custom: { ticket: null } });
        expect(text).toMatchObject({ kind: 'text', quantity: '0', unit_price: '0', unit_id: null, tax_rate_id: null, custom: {} });
        expect(ops.isLocalId(item.id)).toBe(true);
    });
});

describe('positions', () => {
    const base = draft([group('g1', 'Konzept', [position('a'), position('b')]), group('g2', 'Umsetzung', [position('c')])]);

    it('adds after a position or at the end', () => {
        expect(ids(ops.addPosition(base, 'g1', position('x'), 'a'))).toEqual(['g1:a,x,b', 'g2:c']);
        expect(ids(ops.addPosition(base, 'g2', position('x')))).toEqual(['g1:a,b', 'g2:c,x']);
    });

    it('updates one position and leaves the rest untouched (same objects)', () => {
        const next = ops.updatePosition(base, 'b', { title: 'Workshop', unit_price: '450' });

        expect(next.groups[0].positions[1]).toMatchObject({ title: 'Workshop', unit_price: '450' });
        expect(next.groups[1]).toBe(base.groups[1]);
        expect(base.groups[0].positions[1].title).toBe('b');
    });

    it('removes a position and restores it at its place', () => {
        const removed = ops.removePosition(base, 'a');

        expect(ids(removed.draft)).toEqual(['g1:b', 'g2:c']);
        expect(removed).toMatchObject({ groupId: 'g1', index: 0 });
        expect(ids(ops.restorePosition(removed.draft, 'g1', removed.position!, removed.index))).toEqual(['g1:a,b', 'g2:c']);
    });

    it('restores into a new loose group when its group is gone', () => {
        const removed = ops.removePosition(base, 'c');
        const withoutGroup = ops.removeGroup(removed.draft, 'g2').draft;
        const restored = ops.restorePosition(withoutGroup, 'g2', removed.position!, 0);

        expect(restored.groups[0].title).toBeNull();
        expect(restored.groups[0].positions.map((p) => p.id)).toEqual(['c']);
    });

    it('switches kinds: text drops amounts, item restores quantity and defaults', () => {
        const text = ops.setPositionKind(base, 'a', 'text', defaults);
        expect(text.groups[0].positions[0]).toMatchObject({ kind: 'text', quantity: '0', unit_price: '0', unit_id: null, tax_rate_id: null });

        const item = ops.setPositionKind(text, 'a', 'item', defaults);
        expect(item.groups[0].positions[0]).toMatchObject({ kind: 'item', quantity: '1', unit_id: 'unit-h', tax_rate_id: 'rate-19' });

        const optional = ops.setPositionKind(base, 'b', 'optional', defaults);
        expect(optional.groups[0].positions[1]).toMatchObject({ kind: 'optional', quantity: '1', unit_price: '100' });
    });

    it('moves within a group, across groups and clamps the index', () => {
        expect(ids(ops.movePosition(base, 'a', 'g1', 1))).toEqual(['g1:b,a', 'g2:c']);
        expect(ids(ops.movePosition(base, 'a', 'g2', 0))).toEqual(['g1:b', 'g2:a,c']);
        expect(ids(ops.movePosition(base, 'a', 'g2', 99))).toEqual(['g1:b', 'g2:c,a']);
        expect(ops.movePosition(base, 'missing', 'g2', 0)).toBe(base);
    });

    it('finds the group of a position', () => {
        expect(ops.groupOf(base, 'c')?.id).toBe('g2');
        expect(ops.groupOf(base, 'missing')).toBeUndefined();
    });
});

describe('groups', () => {
    const base = draft([group('loose', null, [position('a')]), group('g1', 'Konzept', [position('b')]), group('g2', 'Umsetzung', [position('c')])]);

    it('adds at the end or at the start', () => {
        expect(ids(ops.addGroup(base, 'Betrieb', position('x'))).at(-1)).toMatch(/:x$/);
        const first = ops.addGroup(base, null, position('y'), true);
        expect(first.groups[0]).toMatchObject({ title: null, positions: [expect.objectContaining({ id: 'y' })] });
        expect(ops.isLocalId(first.groups[0].id)).toBe(true);
    });

    it('renames', () => {
        expect(ops.updateGroup(base, 'g1', { title: 'Analyse' }).groups[1].title).toBe('Analyse');
    });

    it('moves groups (drag and drop) and ignores invalid indexes', () => {
        expect(ids(ops.moveGroup(base, 2, 0))).toEqual(['g2:c', 'loose:a', 'g1:b']);
        expect(ids(ops.moveGroup(base, 0, 2))).toEqual(['g1:b', 'g2:c', 'loose:a']);
        expect(ops.moveGroup(base, 5, 0)).toBe(base);
        expect(ops.moveGroup(base, 1, 1)).toBe(base);
    });

    it('removes a group with its positions and restores it at its place (undo)', () => {
        const removed = ops.removeGroup(base, 'g1');

        expect(ids(removed.draft)).toEqual(['loose:a', 'g2:c']);
        expect(removed.index).toBe(1);
        expect(ids(ops.restoreGroup(removed.draft, removed.group!, removed.index))).toEqual(ids(base));
    });

    it('dissolves a group into the loose positions, or turns it loose when there are none', () => {
        expect(ids(ops.dissolveGroup(base, 'g1'))).toEqual(['loose:a,b', 'g2:c']);

        const noLoose = draft([group('g1', 'Konzept', [position('b')])]);
        expect(ops.dissolveGroup(noLoose, 'g1').groups[0]).toMatchObject({ id: 'g1', title: null });
    });
});

describe('texts', () => {
    it('appends a text block after a blank line', () => {
        expect(ops.appendText('', 'Vielen Dank.')).toBe('Vielen Dank.');
        expect(ops.appendText('Hallo,\n  ', 'Vielen Dank.')).toBe('Hallo,\n\nVielen Dank.');
    });
});

describe('server state', () => {
    const detail = {
        ...draft([group('g1', 'Konzept', [position('a', 'Workshop', { custom: { ticket: 'SHOP-1' } })])]),
        number: null,
        customer_name: 'Hafenkontor Lindqvist GmbH',
        source_id: null,
        cancelled_by_id: null,
        is_locked: false,
        is_overdue: false,
        finalized_at: null,
        paid_at: null,
        net_total: '100.00',
        tax_total: '19.00',
        gross_total: '119.00',
        created_at: null,
        updated_at: null,
        totals: null,
        issues: [],
        dropped_fields: [],
    } satisfies DocumentDetail;

    it('takes the editable part of a document as a deep copy', () => {
        const d = ops.fromDocument(detail);

        expect(d).toMatchObject({ id: 'doc', type: 'offer', status: 'draft', valid_until: '2026-10-25' });
        expect(d).not.toHaveProperty('gross_total');
        expect(d.groups[0].positions[0].custom).not.toBe(detail.groups[0].positions[0].custom);
    });

    it('builds the PATCH body with every draft field and without id, type, status', () => {
        const payload = ops.toPayload(ops.fromDocument(detail));

        expect(Object.keys(payload).sort()).toEqual(
            ['closing', 'contact_id', 'custom', 'customer_id', 'date', 'due_date', 'groups', 'intro', 'locale', 'service_date', 'service_date_end', 'template_id', 'valid_until'].sort(),
        );
    });

    it('compares payloads independent of key order', () => {
        const a = ops.toPayload(ops.fromDocument(detail));
        const b = { ...a, custom: { project_name: 'Relaunch' } };
        const { groups, ...rest } = a;
        const reordered = JSON.parse(JSON.stringify({ groups, ...rest })) as typeof a;

        expect(ops.samePayload(a, reordered)).toBe(true);
        expect(ops.samePayload(a, { ...b, intro: 'Hallo' })).toBe(false);
        expect(ops.samePayload(a, null)).toBe(false);
    });

    it('maps local ids to the server ids by position in the answer', () => {
        const sent = ops.toPayload(draft([group('local-g', 'Neu', [position('local-p'), position('b')]), group('g2', null, [position('local-q')])]));
        const saved = [group('01G', 'Neu', [position('01P'), position('b')]), group('g2', null, [position('01Q')])];

        expect(ops.idMap(sent, saved)).toEqual({ 'local-g': '01G', 'local-p': '01P', 'local-q': '01Q' });
        expect(ops.idMap(sent, saved.slice(0, 1))).toEqual({});
    });

    it('replaces ids in the current draft, also when it changed meanwhile (typing during the save)', () => {
        const current = draft([group('local-g', 'Neu', [position('local-p', 'Workshop, getippt während des Speicherns'), position('local-new')])]);

        const next = ops.reconcileIds(current, { 'local-g': '01G', 'local-p': '01P' });

        expect(ids(next)).toEqual(['01G:01P,local-new']);
        expect(next.groups[0].positions[0].title).toBe('Workshop, getippt während des Speicherns');
        expect(ops.reconcileIds(current, {})).toBe(current);
    });
});
