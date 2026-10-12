import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlignLeft, CircleDashed, GripVertical, ListPlus, MoreHorizontal, Package, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { ApiPosition, DocumentType, FieldDefinition, PositionKind, TaxRate, Unit } from '@/api/types';
import { CustomFieldInput } from '@/components/custom-field-input';
import { Button, cx, Menu, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, SelectControl, Tag } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';
import { DecimalCell } from './decimal-cell';
import { TitleAutocomplete } from './title-autocomplete';

const KIND_ICON: Record<PositionKind, ReactNode> = { item: <Package />, optional: <CircleDashed />, text: <AlignLeft /> };

export type PositionRowProps = {
    position: ApiPosition;
    docType: DocumentType;
    taxRates: TaxRate[];
    units: Unit[];
    fields: FieldDefinition[];
    /** Line net from the server (render answer); undefined while unknown. */
    net: string | undefined;
    readOnly: boolean;
    smallBusiness: boolean;
    messages: Record<string, string>;
    autoFocus: boolean;
    onChange(patch: Partial<ApiPosition>): void;
    onKind(kind: PositionKind): void;
    onRemove(): void;
    onEnter(): void;
};

/** Options of a select: active entries plus the chosen one even when archived. */
function choices<T extends { id: string; archived_at: string | null }>(list: T[], chosen: string | null): T[] {
    return list.filter((item) => item.archived_at === null || item.id === chosen);
}

export function SortablePositionRow(props: PositionRowProps) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: `pos:${props.position.id}`, disabled: props.readOnly });
    return (
        <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cx(isDragging && 'relative z-[5] [&>div]:bg-surface [&>div]:shadow-float')}>
            <PositionRow
                {...props}
                handle={
                    props.readOnly ? (
                        <span aria-hidden className="ed-pos__handle w-6" />
                    ) : (
                        <button
                            type="button"
                            ref={setActivatorNodeRef}
                            className="ed-pos__handle grid h-control w-6 cursor-grab touch-none place-items-center self-start rounded-sm text-faint hover:bg-surface-2 hover:text-ink active:cursor-grabbing [&_svg]:size-4"
                            aria-label={t('editor.position_move', { title: props.position.title || t('editor.position') })}
                            {...attributes}
                            {...listeners}
                        >
                            <GripVertical />
                        </button>
                    )
                }
            />
        </div>
    );
}

export function PositionRow({ position: p, docType, taxRates, units, fields, net, readOnly, smallBusiness, messages, autoFocus, onChange, onKind, onRemove, onEnter, handle }: PositionRowProps & { handle: ReactNode }) {
    const [showFields, setShowFields] = useState(false);
    const isText = p.kind === 'text';
    const path = (key: string) => `positions.${p.id}.${key}`;
    const filled = fields.filter((d) => p.custom[d.key] !== null && p.custom[d.key] !== undefined && p.custom[d.key] !== '').length;
    const fieldsInvalid = fields.some((d) => messages[path(`custom.${d.key}`)]);
    const kinds: PositionKind[] = docType === 'offer' ? ['item', 'optional', 'text'] : ['item', 'text'];
    const unitOptions = choices(units, p.unit_id);
    const rateOptions = choices(taxRates, p.tax_rate_id);
    const archived = (label: string, item: { archived_at: string | null } | undefined) => (item?.archived_at ? t('editor.archived', { label }) : label);

    return (
        <div
            data-position-row
            className={cx(
                'ed-pos rounded-md py-1 pr-2 pl-1 transition-colors hover:bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] focus-within:bg-[color-mix(in_srgb,var(--surface)_70%,transparent)]',
                isText && 'ed-pos--text',
                smallBusiness && 'ed-no-tax',
            )}
        >
            {handle}

            <div className="ed-pos__main grid min-w-0 gap-0.5">
                <TitleAutocomplete
                    value={p.title}
                    onChange={(title) => onChange({ title })}
                    onPick={(s) =>
                        onChange({
                            title: s.title,
                            description: s.description,
                            ...(isText
                                ? {}
                                : {
                                      unit_price: s.unit_price,
                                      unit_id: units.some((u) => u.id === s.unit_id && u.archived_at === null) ? s.unit_id : p.unit_id,
                                      tax_rate_id: taxRates.some((r) => r.id === s.tax_rate_id && r.archived_at === null) ? s.tax_rate_id : p.tax_rate_id,
                                  }),
                        })
                    }
                    onEnter={onEnter}
                    withSuggestions={!isText}
                    units={units}
                    disabled={readOnly}
                    autoFocus={autoFocus}
                    error={messages[path('title')]}
                    placeholder={isText ? t('editor.text_placeholder') : t('editor.title_placeholder')}
                    path={path('title')}
                    muted={isText}
                />
                {(!isText || p.description) && (
                    <textarea
                        data-path={path('description')}
                        className="ed-pos__desc min-h-7 w-full resize-none rounded-sm border-0 px-3 py-1 text-sm leading-snug text-muted [field-sizing:content] placeholder:text-faint focus:text-ink focus:shadow-[0_0_0_2px_var(--accent)] focus:outline-none"
                        rows={1}
                        value={p.description}
                        disabled={readOnly}
                        placeholder={t('editor.description_placeholder')}
                        aria-label={t('editor.description')}
                        onChange={(e) => onChange({ description: e.target.value })}
                    />
                )}
                {(p.kind === 'optional' || (!isText && fields.length > 0)) && (
                    <div className="flex flex-wrap items-center gap-2 pl-3">
                        {p.kind === 'optional' && (
                            <Tag neutral>
                                <CircleDashed aria-hidden className="size-3" />
                                {t('editor.optional_tag')}
                            </Tag>
                        )}
                        {!isText && fields.length > 0 && (
                            <button
                                type="button"
                                aria-expanded={showFields || fieldsInvalid}
                                onClick={() => setShowFields((v) => !v)}
                                className={cx('inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs font-medium hover:bg-surface-2 [&_svg]:size-3', fieldsInvalid ? 'text-bad' : 'text-muted hover:text-ink')}
                            >
                                <ListPlus aria-hidden />
                                {t('editor.custom_fields')} <span className="num">{`${filled}/${fields.length}`}</span>
                            </button>
                        )}
                    </div>
                )}
                {!isText && fields.length > 0 && (showFields || fieldsInvalid) && (
                    <div className="mt-1 mb-2 ml-3 grid gap-3 rounded-md bg-surface p-3 [grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))]">
                        {fields.map((d) => (
                            <CustomFieldInput
                                key={d.id}
                                definition={d}
                                value={p.custom[d.key]}
                                disabled={readOnly}
                                path={path(`custom.${d.key}`)}
                                error={messages[path(`custom.${d.key}`)]}
                                onChange={(value) => onChange({ custom: { ...p.custom, [d.key]: value } })}
                            />
                        ))}
                    </div>
                )}
            </div>

            {!isText && (
                <>
                    <DecimalCell className="ed-pos__qty" value={p.quantity} onCommit={(quantity) => onChange({ quantity })} label={t('editor.quantity')} disabled={readOnly} error={messages[path('quantity')]} path={path('quantity')} />
                    <div className="ed-pos__unit" data-path={path('unit')}>
                        <SelectControl value={p.unit_id ?? ''} disabled={readOnly} invalid={!!messages[path('unit')]} title={messages[path('unit')]} aria-label={t('editor.unit')} onChange={(e) => onChange({ unit_id: e.target.value || null })}>
                            {!unitOptions.some((u) => u.id === p.unit_id) && <option value="">{t('editor.unit')}</option>}
                            {unitOptions.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {archived(u.symbol, u)}
                                </option>
                            ))}
                        </SelectControl>
                    </div>
                    <DecimalCell className="ed-pos__price" value={p.unit_price} onCommit={(unit_price) => onChange({ unit_price })} label={t('editor.unit_price')} disabled={readOnly} error={messages[path('unit_price')]} path={path('unit_price')} minFraction={2} suffix="€" />
                    {!smallBusiness && (
                        <div className="ed-pos__tax" data-path={path('tax_rate')}>
                            <SelectControl value={p.tax_rate_id ?? ''} disabled={readOnly} invalid={!!messages[path('tax_rate')]} title={messages[path('tax_rate')]} aria-label={t('editor.tax_rate')} onChange={(e) => onChange({ tax_rate_id: e.target.value || null })}>
                                {!rateOptions.some((r) => r.id === p.tax_rate_id) && <option value="">{t('editor.tax_rate')}</option>}
                                {rateOptions.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {archived(r.label, r)}
                                    </option>
                                ))}
                            </SelectControl>
                        </div>
                    )}
                    <div aria-label={t('editor.line_total')} className={cx('ed-pos__total num flex h-control items-center justify-end whitespace-nowrap', p.kind === 'optional' ? 'font-medium text-muted line-through decoration-faint' : 'font-strong')}>
                        {net === undefined ? '–' : formatMoney(net)}
                    </div>
                </>
            )}

            <div className="ed-pos__menu flex h-control items-center">
                {!readOnly && (
                    <Menu
                        trigger={
                            <Button variant="ghost" size="sm" iconOnly icon={<MoreHorizontal />}>
                                {t('editor.position_menu')}
                            </Button>
                        }
                    >
                        <MenuLabel>{t('editor.kind_label')}</MenuLabel>
                        <MenuRadioGroup value={p.kind} onValueChange={(kind) => onKind(kind as PositionKind)}>
                            {kinds.map((kind) => (
                                <MenuRadioItem key={kind} value={kind} icon={KIND_ICON[kind]}>
                                    {t(`editor.kind.${kind}`)}
                                </MenuRadioItem>
                            ))}
                        </MenuRadioGroup>
                        <MenuSeparator />
                        <MenuItem danger icon={<Trash2 />} onSelect={onRemove}>
                            {t('editor.position_remove')}
                        </MenuItem>
                    </Menu>
                )}
            </div>
        </div>
    );
}
