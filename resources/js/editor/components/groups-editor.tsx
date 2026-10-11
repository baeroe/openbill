import {
    closestCenter,
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    useDroppable,
    useSensor,
    useSensors,
    type Announcements,
    type CollisionDetection,
    type DragEndEvent,
    type DragOverEvent,
    type DragStartEvent,
    type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, FolderPlus, GripVertical, MoreHorizontal, Plus, Trash2, Ungroup } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { useFieldDefinitions } from '@/api/fields';
import { useTaxRates, useUnits } from '@/api/master-data';
import type { ApiGroup, ApiPosition, Totals } from '@/api/types';
import { Button, cx, Menu, MenuItem } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { t, tn } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { isZeroDecimal } from '../decimal';
import { focusAfterMenu, focusSoon } from '../focus';
import * as ops from '../ops';
import { useEditor } from '../store';
import type { Draft } from '../types';
import { SortablePositionRow } from './position-row';

type Props = {
    draft: Draft;
    totals: Totals | null;
    smallBusiness: boolean;
    readOnly: boolean;
    messages: Record<string, string>;
    update(fn: (draft: Draft) => Draft): void;
};

const gid = (id: string) => `group:${id}`;
const pid = (id: string) => `pos:${id}`;
const bodyId = (id: string) => `body:${id}`;
const isGroupId = (id: string | number | undefined) => String(id).startsWith('group:');

/**
 * Arrow keys of the keyboard drag: like dnd-kit's sortable coordinates, but a group only jumps between groups and a
 * position only between positions and group bodies (as in the collision detection) – otherwise an arrow press can
 * land on a row inside a group and leave the dragged group where it was.
 */
const keyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
    const { droppableContainers, active } = args.context;
    const sameKind = (entry: { id: string | number } | undefined) => !!entry && isGroupId(entry.id) === isGroupId(active?.id);
    const only = {
        ...droppableContainers,
        getEnabled: () => droppableContainers.getEnabled().filter(sameKind),
        get: (id: string | number) => droppableContainers.get(id),
    } as typeof droppableContainers;
    return sortableKeyboardCoordinates(event, { ...args, context: { ...args.context, droppableContainers: only } });
};

const strip = (id: string | number) => String(id).replace(/^(group|pos|body):/, '');

/** Groups with drag and drop: groups among each other, positions within and between groups (keyboard: Space, arrows, Space). */
export function GroupsEditor({ draft, totals, smallBusiness, readOnly, messages, update }: Props) {
    const collapsed = useEditor((state) => state.collapsed);
    const toggleGroup = useEditor((state) => state.toggleGroup);
    const aliases = useEditor((state) => state.aliases);
    // React keys survive the id swap after a save (review focus: no focus loss while typing)
    const keyOf = (id: string) => aliases[id] ?? id;
    const taxRates = useTaxRates().data ?? [];
    const units = useUnits().data ?? [];
    const fields = (useFieldDefinitions('position').data ?? []).filter((d) => d.doc_types.includes(draft.type));
    const [focusId, setFocusId] = useState<string | null>(null);
    const [dragging, setDragging] = useState<string | null>(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }));

    const defaults: ops.PositionDefaults = {
        unitId: units.find((u) => u.archived_at === null)?.id ?? null,
        taxRateId: taxRates.find((r) => r.archived_at === null)?.id ?? null,
        custom: Object.fromEntries(fields.map((d) => [d.key, d.default_value ?? null])),
    };

    // groups collide only with groups, positions with positions and group bodies (empty groups)
    const collision: CollisionDetection = (args) => {
        const isGroup = String(args.active.id).startsWith('group:');
        return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => String(c.id).startsWith('group:') === isGroup) });
    };

    // groups before the drag: Escape (cancel) puts a position back that onDragOver already moved into another group
    const beforeDrag = useRef<ApiGroup[] | null>(null);

    const onDragStart = (e: DragStartEvent) => {
        beforeDrag.current = draft.groups;
        setDragging(String(e.active.id));
    };

    const onDragOver = ({ active, over }: DragOverEvent) => {
        if (!over || !String(active.id).startsWith('pos:')) return;
        const positionId = strip(active.id);
        const from = ops.groupOf(draft, positionId);
        const target = ops.dropTarget(draft, String(over.id));
        if (!from || !target || from.id === target.groupId) return;
        update((d) => ops.movePosition(d, positionId, target.groupId, target.index));
    };

    const onDragEnd = ({ active, over }: DragEndEvent) => {
        setDragging(null);
        beforeDrag.current = null;
        if (!over || active.id === over.id) return;
        const activeId = String(active.id);
        if (activeId.startsWith('group:')) {
            const from = draft.groups.findIndex((g) => g.id === strip(activeId));
            const to = draft.groups.findIndex((g) => g.id === strip(over.id));
            if (from >= 0 && to >= 0) update((d) => ops.moveGroup(d, from, to));
            return;
        }
        const positionId = strip(activeId);
        const group = ops.groupOf(draft, positionId);
        const target = ops.dropTarget(draft, String(over.id));
        if (!group || !target || target.groupId !== group.id) return;
        update((d) => ops.movePosition(d, positionId, group.id, target.index));
    };

    const onDragCancel = () => {
        setDragging(null);
        const groups = beforeDrag.current;
        beforeDrag.current = null;
        if (groups) update((d) => ({ ...d, groups }));
    };

    // screen reader texts of the keyboard drag and drop: in the UI language and with titles, never with ids
    const name = (dndId: string | number) => {
        const id = strip(dndId);
        if (String(dndId).startsWith('group:')) return draft.groups.find((g) => g.id === id)?.title ?? t('editor.loose');
        return ops.groupOf(draft, id)?.positions.find((p) => p.id === id)?.title || t('editor.position');
    };
    const place = (activeId: string | number, overId: string | number) => {
        if (String(activeId).startsWith('group:')) {
            const n = draft.groups.findIndex((g) => g.id === strip(overId));
            return n < 0 ? null : { group: '', n: n + 1, count: draft.groups.length };
        }
        const target = ops.dropTarget(draft, String(overId));
        if (!target) return null;
        const group = draft.groups.find((g) => g.id === target.groupId)!;
        const own = group.positions.some((p) => p.id === strip(activeId));
        const count = group.positions.length + (own ? 0 : 1);
        return { group: group.title ?? t('editor.loose'), n: Math.min(target.index, count - 1) + 1, count };
    };
    const announce = (kind: 'moved' | 'dropped', activeId: string | number, overId: string | number | undefined) => {
        const title = name(activeId);
        const at = overId === undefined ? null : place(activeId, overId);
        if (!at) return t('editor.dnd.no_target', { title });
        const isGroup = String(activeId).startsWith('group:');
        return t(`editor.dnd.${kind}_${isGroup ? 'group' : 'position'}`, { title, group: at.group, n: at.n, count: at.count });
    };
    const announcements: Announcements = {
        onDragStart: ({ active }) => t('editor.dnd.picked', { title: name(active.id) }),
        // dnd-kit reports "over itself" right after the pick-up: saying it would replace the pick-up announcement
        onDragOver: ({ active, over }) => (over?.id === active.id ? undefined : announce('moved', active.id, over?.id)),
        onDragEnd: ({ active, over }) => announce('dropped', active.id, over?.id),
        onDragCancel: ({ active }) => t('editor.dnd.cancelled', { title: name(active.id) }),
    };

    const addPosition = (groupId: string, afterId?: string) => {
        const position = ops.newPosition('item', defaults);
        update((d) => ops.addPosition(d, groupId, position, afterId));
        setFocusId(position.id);
    };

    const addGroup = () => {
        const titled = draft.groups.filter((g) => g.title !== null).length;
        const before = new Set(draft.groups.map((g) => g.id));
        update((d) => ops.addGroup(d, t('editor.group_default', { n: titled + 1 }), ops.newPosition('item', defaults)));
        // new group: focus and select its title so the name can be typed right away
        focusSoon(() => [...document.querySelectorAll<HTMLInputElement>('input[data-group-title]')].find((el) => !before.has(el.dataset.groupTitle ?? '')), { select: true });
    };

    const addLoose = () => {
        const position = ops.newPosition('item', defaults);
        update((d) => ops.addGroup(d, null, position, true));
        setFocusId(position.id);
    };

    // the undo toast stays after leaving the page: it may only restore into this document
    const documentId = draft.id;
    const undoFor = (fn: (d: Draft) => Draft) => useEditor.getState().updateFor(documentId, fn);

    /** Focus target after a removal (the menu trigger is gone with its row): a row title, a group name or an add button. */
    const rowTitle = (id: string) => () => document.querySelector<HTMLElement>(`[data-path="positions.${id}.title"] input`);
    const groupStart = (group: ApiGroup | undefined) => () => {
        if (!group) return document.querySelector<HTMLElement>('[data-add-group]');
        const box = document.querySelector<HTMLElement>(`[data-group-id="${group.id}"]`);
        return box?.querySelector<HTMLElement>('input[data-group-title], [data-position-row] input[role="combobox"], [data-add-position]') ?? null;
    };

    const removeGroup = (group: ApiGroup) => {
        const { group: removed, index } = ops.removeGroup(draft, group.id);
        if (!removed) return;
        const next = draft.groups[index + 1] ?? draft.groups[index - 1];
        update((d) => ops.removeGroup(d, group.id).draft);
        focusAfterMenu(groupStart(next));
        toast.info(t('editor.group_removed', { title: group.title ?? t('editor.loose') }), {
            label: t('editor.undo'),
            run: () => {
                undoFor((d) => ops.restoreGroup(d, removed, index));
                focusSoon(groupStart(removed));
            },
        });
    };

    const removePosition = (position: ApiPosition) => {
        const result = ops.removePosition(draft, position.id);
        if (!result.position || !result.groupId) return;
        const { groupId, index } = result;
        const siblings = draft.groups.find((g) => g.id === groupId)!.positions;
        const next = siblings[index + 1] ?? siblings[index - 1];
        update((d) => ops.removePosition(d, position.id).draft);
        focusAfterMenu(next ? rowTitle(next.id) : () => document.querySelector<HTMLElement>(`[data-group-id="${groupId}"] [data-add-position]`) ?? document.querySelector<HTMLElement>('[data-add-group]'));
        if (position.title.trim() || !isZeroDecimal(position.unit_price)) {
            toast.info(t('editor.position_removed', { title: position.title || t('editor.position') }), {
                label: t('editor.undo'),
                run: () => {
                    undoFor((d) => ops.restorePosition(d, groupId, position, index));
                    focusSoon(rowTitle(position.id));
                },
            });
        }
    };

    // the last render answer may still key lines, groups and issue paths by the local id a row had before its first save
    const rowMessages = { ...messages };
    for (const [server, local] of Object.entries(aliases)) {
        for (const [path, message] of Object.entries(messages)) {
            for (const prefix of [`positions.${local}.`, `groups.${local}.`]) {
                if (path.startsWith(prefix)) rowMessages[`${prefix.split('.')[0]}.${server}.${path.slice(prefix.length)}`] ??= message;
            }
        }
    }

    const titled = draft.groups.filter((g) => g.title !== null).length;
    const draggingGroup = dragging?.startsWith('group:') ? draft.groups.find((g) => g.id === strip(dragging)) : null;

    return (
        <div className="ed-groups grid gap-3" data-path="positions">
            <div className={cx('ed-pos-head pr-3 pl-2 text-xs font-medium text-muted', smallBusiness && 'ed-no-tax')} aria-hidden>
                <span />
                <span>{t('editor.col_title')}</span>
                <span className="text-right">{t('editor.col_quantity')}</span>
                <span>{t('editor.col_unit')}</span>
                <span className="text-right">{t('editor.col_price')}</span>
                {!smallBusiness && <span>{t('editor.col_tax')}</span>}
                <span className="text-right">{t('editor.col_total')}</span>
                <span />
            </div>

            <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}
                onDragCancel={onDragCancel}
                accessibility={{ announcements, screenReaderInstructions: { draggable: t('editor.dnd.instructions') } }}
            >
                <SortableContext items={draft.groups.map((g) => gid(g.id))} strategy={verticalListSortingStrategy}>
                    {(readOnly ? draft.groups.filter((g) => g.positions.length > 0) : draft.groups).map((group) => (
                        <SortableGroup
                            key={keyOf(group.id)}
                            group={group}
                            readOnly={readOnly}
                            collapsed={collapsed.includes(group.id)}
                            canDrag={titled > 0 || draft.groups.length > 1}
                            total={(totals?.groups[group.id] ?? totals?.groups[keyOf(group.id)])?.net}
                            optionalTotal={(totals?.groups[group.id] ?? totals?.groups[keyOf(group.id)])?.optional_net}
                            error={rowMessages[`groups.${group.id}.title`]}
                            onToggle={() => toggleGroup(group.id)}
                            onRename={(title) => update((d) => ops.updateGroup(d, group.id, { title }))}
                            onRemove={() => removeGroup(group)}
                            onDissolve={() => update((d) => ops.dissolveGroup(d, group.id))}
                            onAdd={() => addPosition(group.id)}
                        >
                            <SortableContext items={group.positions.map((p) => pid(p.id))} strategy={verticalListSortingStrategy}>
                                {group.positions.map((position, i) => (
                                    <SortablePositionRow
                                        key={keyOf(position.id)}
                                        position={position}
                                        docType={draft.type}
                                        taxRates={taxRates}
                                        units={units}
                                        fields={fields}
                                        net={(totals?.lines[position.id] ?? totals?.lines[keyOf(position.id)])?.net}
                                        readOnly={readOnly}
                                        smallBusiness={smallBusiness}
                                        messages={rowMessages}
                                        autoFocus={focusId === position.id}
                                        onChange={(patch) => update((d) => ops.updatePosition(d, position.id, patch))}
                                        onKind={(kind) => update((d) => ops.setPositionKind(d, position.id, kind, defaults))}
                                        onRemove={() => removePosition(position)}
                                        onEnter={() => {
                                            if (i === group.positions.length - 1) addPosition(group.id, position.id);
                                        }}
                                    />
                                ))}
                            </SortableContext>
                        </SortableGroup>
                    ))}
                </SortableContext>
                <DragOverlay>
                    {draggingGroup && (
                        <div className="flex cursor-grabbing items-center gap-2 rounded-lg bg-surface p-3 shadow-float">
                            <GripVertical aria-hidden className="size-4 text-muted" />
                            <b>{draggingGroup.title ?? t('editor.loose')}</b>
                        </div>
                    )}
                </DragOverlay>
            </DndContext>

            {draft.groups.every((g) => g.positions.length === 0) && !readOnly && <p className="px-1 py-2 text-sm text-muted">{t('editor.positions_empty')}</p>}

            {!readOnly && (
                <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="soft" size="sm" icon={<FolderPlus />} onClick={addGroup} data-add-group>
                        {t('editor.add_group')}
                    </Button>
                    {!draft.groups.some((g) => g.title === null) && (
                        <Button variant="ghost" size="sm" icon={<Plus />} onClick={addLoose}>
                            {t('editor.add_loose')}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

type GroupProps = {
    group: ApiGroup;
    readOnly: boolean;
    collapsed: boolean;
    canDrag: boolean;
    total: string | undefined;
    optionalTotal: string | undefined;
    error?: string;
    onToggle(): void;
    onRename(title: string): void;
    onRemove(): void;
    onDissolve(): void;
    onAdd(): void;
    children: ReactNode;
};

function SortableGroup({ group: g, readOnly, collapsed, canDrag, total, optionalTotal, error, onToggle, onRename, onRemove, onDissolve, onAdd, children }: GroupProps) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: gid(g.id), disabled: readOnly || !canDrag });
    const { setNodeRef: setBodyRef, isOver } = useDroppable({ id: bodyId(g.id), disabled: readOnly });
    const loose = g.title === null;
    const count = g.positions.filter((p) => p.kind !== 'text').length;

    return (
        <div
            ref={setNodeRef}
            role="group"
            data-group-id={g.id}
            aria-label={g.title ?? t('editor.loose')}
            style={{ transform: CSS.Translate.toString(transform), transition }}
            className={cx('rounded-lg px-1 py-2 transition-[box-shadow,background-color]', loose ? 'bg-transparent' : 'bg-bg', isDragging && 'opacity-40', isOver && 'shadow-[inset_0_0_0_2px_var(--accent-soft-hover)]')}
        >
            {!loose && (
                <div className="flex items-center gap-1 pt-0.5 pr-2 pb-2 pl-1" data-path={`groups.${g.id}.title`}>
                    {!readOnly && (
                        <button
                            type="button"
                            ref={setActivatorNodeRef}
                            aria-label={t('editor.group_move', { title: g.title ?? '' })}
                            className="grid h-control w-6 shrink-0 cursor-grab touch-none place-items-center rounded-sm text-faint hover:bg-surface-2 hover:text-ink active:cursor-grabbing [&_svg]:size-4"
                            {...attributes}
                            {...listeners}
                        >
                            <GripVertical />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onToggle}
                        aria-expanded={!collapsed}
                        aria-label={collapsed ? t('editor.group_expand') : t('editor.group_collapse')}
                        className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink [&_svg]:size-4 [&_svg]:transition-transform aria-[expanded=false]:[&_svg]:-rotate-90"
                    >
                        <ChevronDown />
                    </button>
                    <input
                        data-group-title={g.id}
                        value={g.title ?? ''}
                        disabled={readOnly}
                        aria-label={t('editor.group_name')}
                        aria-invalid={error ? true : undefined}
                        title={error}
                        placeholder={t('editor.group_name')}
                        className={cx(
                            'h-8 min-w-24 flex-1 rounded-sm border-0 bg-transparent px-2 text-lg font-heading tracking-tight text-ink hover:enabled:bg-surface focus:bg-surface focus:shadow-[0_0_0_2px_var(--accent)] focus:outline-none',
                            error && 'shadow-[0_0_0_2px_var(--bad)]',
                        )}
                        onChange={(e) => onRename(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                e.currentTarget.closest('[role="group"]')?.querySelector<HTMLInputElement>('[data-position-row] input[role="combobox"]')?.focus();
                            }
                        }}
                    />
                    {collapsed && <span className="text-xs whitespace-nowrap text-muted">{tn('editor.group_count', count)}</span>}
                    <span className="ml-auto flex items-baseline gap-2 px-2 font-strong whitespace-nowrap" title={t('editor.group_subtotal')}>
                        {optionalTotal !== undefined && !isZeroDecimal(optionalTotal) && <span className="text-xs font-medium text-muted">{t('editor.group_optional', { amount: formatMoney(optionalTotal) })}</span>}
                        <span className="num">{total === undefined ? '–' : formatMoney(total)}</span>
                    </span>
                    {readOnly ? (
                        // keeps the subtotal in line with the row totals, which reserve the room of their menu
                        <span aria-hidden className="w-8 shrink-0" />
                    ) : (
                        <Menu
                            trigger={
                                <Button variant="ghost" size="sm" iconOnly icon={<MoreHorizontal />}>
                                    {t('editor.group_menu')}
                                </Button>
                            }
                        >
                            <MenuItem icon={<Ungroup />} onSelect={onDissolve}>
                                {t('editor.group_dissolve')}
                            </MenuItem>
                            <MenuItem danger icon={<Trash2 />} onSelect={onRemove}>
                                {t('editor.group_remove')}
                            </MenuItem>
                        </Menu>
                    )}
                </div>
            )}
            {!collapsed && (
                <div ref={setBodyRef} className="grid min-h-10 gap-0.5">
                    {children}
                    {g.positions.length === 0 && !readOnly && <p className="px-4 py-3 text-sm text-faint">{t('editor.group_empty')}</p>}
                    {!readOnly && (
                        <div className="flex gap-2 pt-0.5 pr-2 pl-9">
                            <button type="button" data-add-position onClick={onAdd} className="inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-accent hover:bg-accent-soft [&_svg]:size-[0.95rem]">
                                <Plus aria-hidden />
                                {t('editor.add_position')}
                            </button>
                            {loose && g.positions.length === 0 && (
                                <button type="button" onClick={onRemove} className="inline-flex h-8 items-center rounded-full px-2 text-sm font-medium text-muted hover:bg-surface-2">
                                    {t('editor.remove')}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
