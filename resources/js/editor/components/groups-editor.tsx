import {
    closestCenter,
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    useDroppable,
    useSensor,
    useSensors,
    type CollisionDetection,
    type DragEndEvent,
    type DragOverEvent,
    type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, FolderPlus, GripVertical, MoreHorizontal, Plus, Trash2, Ungroup } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useFieldDefinitions } from '@/api/fields';
import { useTaxRates, useUnits } from '@/api/master-data';
import type { ApiGroup, ApiPosition, Totals } from '@/api/types';
import { Button, cx, Menu, MenuItem } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { t, tn } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { isZeroDecimal } from '../decimal';
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
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

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

    const targetGroup = (overId: string) => (overId.startsWith('body:') ? strip(overId) : overId.startsWith('pos:') ? ops.groupOf(draft, strip(overId))?.id : undefined);

    const onDragStart = (e: DragStartEvent) => setDragging(String(e.active.id));

    const onDragOver = ({ active, over }: DragOverEvent) => {
        if (!over || !String(active.id).startsWith('pos:')) return;
        const positionId = strip(active.id);
        const from = ops.groupOf(draft, positionId);
        const to = targetGroup(String(over.id));
        if (!from || !to || from.id === to) return;
        const target = draft.groups.find((g) => g.id === to)!;
        const index = String(over.id).startsWith('pos:') ? target.positions.findIndex((p) => p.id === strip(over.id)) : target.positions.length;
        update((d) => ops.movePosition(d, positionId, to, index < 0 ? target.positions.length : index));
    };

    const onDragEnd = ({ active, over }: DragEndEvent) => {
        setDragging(null);
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
        if (!group || group.id !== targetGroup(String(over.id))) return;
        const index = String(over.id).startsWith('pos:') ? group.positions.findIndex((p) => p.id === strip(over.id)) : group.positions.length - 1;
        update((d) => ops.movePosition(d, positionId, group.id, index));
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
        requestAnimationFrame(() => {
            const input = [...document.querySelectorAll<HTMLInputElement>('input[data-group-title]')].find((el) => !before.has(el.dataset.groupTitle ?? ''));
            input?.focus();
            input?.select();
        });
    };

    const addLoose = () => {
        const position = ops.newPosition('item', defaults);
        update((d) => ops.addGroup(d, null, position, true));
        setFocusId(position.id);
    };

    const removeGroup = (group: ApiGroup) => {
        const { group: removed, index } = ops.removeGroup(draft, group.id);
        if (!removed) return;
        update((d) => ops.removeGroup(d, group.id).draft);
        toast.info(t('editor.group_removed', { title: group.title ?? t('editor.loose') }), { label: t('editor.undo'), run: () => update((d) => ops.restoreGroup(d, removed, index)) });
    };

    const removePosition = (position: ApiPosition) => {
        const result = ops.removePosition(draft, position.id);
        if (!result.position || !result.groupId) return;
        const { groupId, index } = result;
        update((d) => ops.removePosition(d, position.id).draft);
        if (position.title.trim() || !isZeroDecimal(position.unit_price)) {
            toast.info(t('editor.position_removed', { title: position.title || t('editor.position') }), {
                label: t('editor.undo'),
                run: () => update((d) => ops.restorePosition(d, groupId, position, index)),
            });
        }
    };

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

            <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
                <SortableContext items={draft.groups.map((g) => gid(g.id))} strategy={verticalListSortingStrategy}>
                    {draft.groups.map((group) => (
                        <SortableGroup
                            key={keyOf(group.id)}
                            group={group}
                            readOnly={readOnly}
                            collapsed={collapsed.includes(group.id)}
                            canDrag={titled > 0 || draft.groups.length > 1}
                            total={totals?.groups[group.id]?.net}
                            optionalTotal={totals?.groups[group.id]?.optional_net}
                            error={messages[`groups.${group.id}.title`]}
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
                                        net={totals?.lines[position.id]?.net}
                                        readOnly={readOnly}
                                        smallBusiness={smallBusiness}
                                        messages={messages}
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
                    <Button variant="soft" size="sm" icon={<FolderPlus />} onClick={addGroup}>
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
                    {!readOnly && (
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
                    {g.positions.length === 0 && <p className="px-4 py-3 text-sm text-faint">{t('editor.group_empty')}</p>}
                    {!readOnly && (
                        <div className="flex gap-2 pt-0.5 pr-2 pl-9">
                            <button type="button" onClick={onAdd} className="inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-accent hover:bg-accent-soft [&_svg]:size-[0.95rem]">
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
