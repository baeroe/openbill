import type { ApiGroup, ApiPosition, CustomValues, DocumentDetail, PositionKind } from '@/api/types';
import type { Draft, DraftPayload, IdMap } from './types';

/**
 * Pure operations on the local draft. They only rearrange data – amounts stay the strings the user typed,
 * totals and checks come from the server (POST /api/render).
 */

export const LOCAL_PREFIX = 'local-';

/** Id of a group or position the server has not seen yet (GroupWriter gives it a ULID on save). */
export function localId(): string {
    return `${LOCAL_PREFIX}${crypto.randomUUID()}`;
}

export function isLocalId(id: string): boolean {
    return id.startsWith(LOCAL_PREFIX);
}

export type PositionDefaults = { unitId: string | null; taxRateId: string | null; custom: CustomValues };

export function newPosition(kind: PositionKind, defaults: PositionDefaults): ApiPosition {
    const priced = kind !== 'text';
    return {
        id: localId(),
        kind,
        title: '',
        description: '',
        quantity: priced ? '1' : '0',
        unit_id: priced ? defaults.unitId : null,
        unit_price: '0',
        tax_rate_id: priced ? defaults.taxRateId : null,
        custom: priced ? { ...defaults.custom } : {},
    };
}

const copyGroups = (groups: ApiGroup[]): ApiGroup[] =>
    groups.map((group) => ({ ...group, positions: group.positions.map((position) => ({ ...position, custom: { ...position.custom } })) }));

export function fromDocument(document: DocumentDetail): Draft {
    return {
        id: document.id,
        type: document.type,
        status: document.status,
        date: document.date,
        customer_id: document.customer_id,
        contact_id: document.contact_id,
        service_date: document.service_date,
        service_date_end: document.service_date_end,
        due_date: document.due_date,
        valid_until: document.valid_until,
        intro: document.intro,
        closing: document.closing,
        template_id: document.template_id,
        locale: document.locale,
        custom: { ...document.custom },
        groups: copyGroups(document.groups),
    };
}

export function toPayload(draft: Draft): DraftPayload {
    return {
        date: draft.date,
        customer_id: draft.customer_id,
        contact_id: draft.contact_id,
        service_date: draft.service_date,
        service_date_end: draft.service_date_end,
        due_date: draft.due_date,
        valid_until: draft.valid_until,
        intro: draft.intro,
        closing: draft.closing,
        template_id: draft.template_id,
        locale: draft.locale,
        custom: draft.custom,
        groups: draft.groups,
    };
}

/** JSON with sorted object keys: the server may order custom values differently than the browser. */
function stable(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value !== null && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
        return `{${entries.map(([key, v]) => `${JSON.stringify(key)}:${stable(v)}`).join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
}

export function samePayload(a: DraftPayload | null, b: DraftPayload | null): boolean {
    if (a === null || b === null) return false;
    return stable(a) === stable(b);
}

const mapGroups = (draft: Draft, fn: (group: ApiGroup) => ApiGroup): Draft => ({ ...draft, groups: draft.groups.map(fn) });

export function groupOf(draft: Draft, positionId: string): ApiGroup | undefined {
    return draft.groups.find((group) => group.positions.some((p) => p.id === positionId));
}

export function addPosition(draft: Draft, groupId: string, position: ApiPosition, afterId?: string): Draft {
    return mapGroups(draft, (group) => {
        if (group.id !== groupId) return group;
        const positions = [...group.positions];
        const index = afterId ? positions.findIndex((p) => p.id === afterId) : -1;
        positions.splice(index < 0 ? positions.length : index + 1, 0, position);
        return { ...group, positions };
    });
}

export function updatePosition(draft: Draft, id: string, patch: Partial<ApiPosition>): Draft {
    return mapGroups(draft, (group) =>
        group.positions.some((p) => p.id === id) ? { ...group, positions: group.positions.map((p) => (p.id === id ? { ...p, ...patch } : p)) } : group,
    );
}

const ZERO = /^-?0*(\.0*)?$/;

/** Text lines carry no amounts; items/optional ones get a quantity and the defaults back. */
export function setPositionKind(draft: Draft, id: string, kind: PositionKind, defaults: PositionDefaults): Draft {
    const current = draft.groups.flatMap((group) => group.positions).find((p) => p.id === id);
    if (!current || current.kind === kind) return draft;
    if (kind === 'text') return updatePosition(draft, id, { kind, quantity: '0', unit_price: '0', unit_id: null, tax_rate_id: null });
    return updatePosition(draft, id, {
        kind,
        quantity: current.quantity === '' || ZERO.test(current.quantity) ? '1' : current.quantity,
        unit_id: current.unit_id ?? defaults.unitId,
        tax_rate_id: current.tax_rate_id ?? defaults.taxRateId,
    });
}

export function removePosition(draft: Draft, id: string): { draft: Draft; position: ApiPosition | null; groupId: string | null; index: number } {
    const group = groupOf(draft, id);
    if (!group) return { draft, position: null, groupId: null, index: -1 };
    const index = group.positions.findIndex((p) => p.id === id);
    return {
        draft: mapGroups(draft, (g) => (g.id === group.id ? { ...g, positions: g.positions.filter((p) => p.id !== id) } : g)),
        position: group.positions[index],
        groupId: group.id,
        index,
    };
}

/** Undo of removePosition: back at its index, or in a new loose group when its group is gone. */
export function restorePosition(draft: Draft, groupId: string, position: ApiPosition, index: number): Draft {
    if (!draft.groups.some((g) => g.id === groupId)) return addGroup(draft, null, position, true);
    return mapGroups(draft, (group) => {
        if (group.id !== groupId) return group;
        const positions = [...group.positions];
        positions.splice(Math.max(0, Math.min(index, positions.length)), 0, position);
        return { ...group, positions };
    });
}

export function addGroup(draft: Draft, title: string | null, first: ApiPosition, atStart = false): Draft {
    const group: ApiGroup = { id: localId(), title, positions: [first] };
    return { ...draft, groups: atStart ? [group, ...draft.groups] : [...draft.groups, group] };
}

export function updateGroup(draft: Draft, id: string, patch: Partial<Pick<ApiGroup, 'title'>>): Draft {
    return mapGroups(draft, (group) => (group.id === id ? { ...group, ...patch } : group));
}

export function removeGroup(draft: Draft, id: string): { draft: Draft; group: ApiGroup | null; index: number } {
    const index = draft.groups.findIndex((g) => g.id === id);
    if (index < 0) return { draft, group: null, index };
    return { draft: { ...draft, groups: draft.groups.filter((g) => g.id !== id) }, group: draft.groups[index], index };
}

export function restoreGroup(draft: Draft, group: ApiGroup, index: number): Draft {
    const groups = [...draft.groups];
    groups.splice(Math.max(0, Math.min(index, groups.length)), 0, group);
    return { ...draft, groups };
}

/** The positions of a group join the loose positions (no heading); without loose positions the group loses its title. */
export function dissolveGroup(draft: Draft, id: string): Draft {
    const group = draft.groups.find((g) => g.id === id);
    if (!group) return draft;
    const loose = draft.groups.find((g) => g.title === null && g.id !== id);
    if (!loose) return updateGroup(draft, id, { title: null });
    return {
        ...draft,
        groups: draft.groups.filter((g) => g.id !== id).map((g) => (g.id === loose.id ? { ...g, positions: [...g.positions, ...group.positions] } : g)),
    };
}

export function moveGroup(draft: Draft, from: number, to: number): Draft {
    const count = draft.groups.length;
    if (from === to || from < 0 || to < 0 || from >= count || to >= count) return draft;
    const groups = [...draft.groups];
    const [moved] = groups.splice(from, 1);
    groups.splice(to, 0, moved);
    return { ...draft, groups };
}

/** Moves a position into a group at an index (also within the same group). */
export function movePosition(draft: Draft, positionId: string, toGroupId: string, toIndex: number): Draft {
    const from = groupOf(draft, positionId);
    if (!from || !draft.groups.some((g) => g.id === toGroupId)) return draft;
    const moved = from.positions.find((p) => p.id === positionId)!;
    const without = draft.groups.map((g) => (g.id === from.id ? { ...g, positions: g.positions.filter((p) => p.id !== positionId) } : g));
    return {
        ...draft,
        groups: without.map((g) => {
            if (g.id !== toGroupId) return g;
            const positions = [...g.positions];
            positions.splice(Math.max(0, Math.min(toIndex, positions.length)), 0, moved);
            return { ...g, positions };
        }),
    };
}

/** Text block into the introduction/closing: after a blank line, or alone when the field is empty. */
export function appendText(current: string, block: string): string {
    return current.trim() ? `${current.trimEnd()}\n\n${block}` : block;
}

/**
 * Which ids the server gave the sent groups and positions: the answer lists them in the order they were sent.
 * Different shapes (another save in between) give an empty map – the next save sends the local ids again.
 */
export function idMap(sent: DraftPayload, saved: ApiGroup[]): IdMap {
    const map: IdMap = {};
    if (sent.groups.length !== saved.length) return map;
    sent.groups.forEach((group, g) => {
        const target = saved[g];
        if (group.id !== target.id) map[group.id] = target.id;
        if (group.positions.length !== target.positions.length) return;
        group.positions.forEach((position, p) => {
            if (position.id !== target.positions[p].id) map[position.id] = target.positions[p].id;
        });
    });
    return map;
}

export function reconcileIds(draft: Draft, map: IdMap): Draft {
    if (Object.keys(map).length === 0) return draft;
    return {
        ...draft,
        groups: draft.groups.map((group) => ({
            ...group,
            id: map[group.id] ?? group.id,
            positions: group.positions.map((position) => (map[position.id] ? { ...position, id: map[position.id] } : position)),
        })),
    };
}
