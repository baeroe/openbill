import { Archive, ChevronDown, Pencil, Percent, Plus, RotateCcw, Ruler } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTaxRates, useUnits } from '@/api/master-data';
import { archiveTaxRate, archiveUnit, restoreTaxRate, restoreUnit, type TaxRateInput, type UnitInput } from '@/api/settings';
import type { TaxRate, Unit } from '@/api/types';
import { Badge, Button, CardHead, EmptyState, ErrorState, ListSkeleton, Tag, cx } from '@/components/ui';
import { SettingsCard } from './settings-card';
import { errorMessage } from '@/lib/api';
import { formatPercent } from '@/lib/format';
import { t, tn } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { TaxRateDrawer } from './tax-rate-drawer';
import { UnitDrawer } from './unit-drawer';

const ROW = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-md px-3 py-2.5 hover:bg-surface sm:grid-cols-[minmax(0,1fr)_7rem_3rem_auto]';

/** Archive with undo: DELETE archives (documents keep pointing at it), undo restores. */
async function archiveWithUndo(label: string, archive: () => Promise<unknown>, restore: () => Promise<unknown>): Promise<void> {
    try {
        await archive();
        toast.success(t('settings.archived', { label }), {
            label: t('fields.undo'),
            run: () => void restore().then(() => toast.info(t('settings.restored', { label }))).catch((error: unknown) => toast.error(errorMessage(error))),
        });
    } catch (error) {
        toast.error(errorMessage(error));
    }
}

export function TaxesUnitsSettings() {
    const rates = useTaxRates();
    const units = useUnits();
    const [rate, setRate] = useState<{ input: TaxRateInput; id?: string } | null>(null);
    const [unit, setUnit] = useState<{ input: UnitInput; id?: string } | null>(null);
    const newRate = () => setRate({ input: { label: '', percent: '19', category: 'S', exemption_note: null } });
    const newUnit = () => setUnit({ input: { name: '', symbol: '', decimals: 2, code: '' } });

    return (
        <div className="grid gap-6">
            <Section
                title={t('settings.tax_rates')}
                description={t('settings.tax_rates_text')}
                action={
                    <Button size="sm" variant="soft" icon={<Plus />} onClick={newRate}>
                        {t('settings.rate_add')}
                    </Button>
                }
                query={rates}
                empty={
                    <EmptyState icon={<Percent />} title={t('settings.rates_empty')} actions={<Button variant="primary" icon={<Plus />} onClick={newRate}>{t('settings.rate_add')}</Button>}>
                        {t('settings.rates_empty_text')}
                    </EmptyState>
                }
                render={(item: TaxRate) => (
                    <>
                        <button type="button" className="grid min-w-0 gap-0.5 text-left" onClick={() => setRate({ input: item, id: item.id })}>
                            <span className="font-strong">{item.label}</span>
                            <span className="truncate text-sm text-muted">{item.exemption_note ?? t(`tax_category.${item.category}`)}</span>
                        </button>
                        <span className="num hidden text-right sm:block">{formatPercent(item.percent)}</span>
                        <span className="hidden sm:block">
                            <Badge plain>{item.category}</Badge>
                        </span>
                    </>
                )}
                onEdit={(item) => setRate({ input: item, id: item.id })}
                onArchive={(item) => void archiveWithUndo(item.label, () => archiveTaxRate(item.id), () => restoreTaxRate(item.id))}
                onRestore={(item) => void restoreTaxRate(item.id).catch((error: unknown) => toast.error(errorMessage(error)))}
                label={(item) => item.label}
            />
            <Section
                title={t('settings.units')}
                description={t('settings.units_text')}
                action={
                    <Button size="sm" variant="soft" icon={<Plus />} onClick={newUnit}>
                        {t('settings.unit_add')}
                    </Button>
                }
                query={units}
                empty={
                    <EmptyState icon={<Ruler />} title={t('settings.units_empty')} actions={<Button variant="primary" icon={<Plus />} onClick={newUnit}>{t('settings.unit_add')}</Button>}>
                        {t('settings.units_empty_text')}
                    </EmptyState>
                }
                render={(item: Unit) => (
                    <>
                        <button type="button" className="grid min-w-0 gap-0.5 text-left" onClick={() => setUnit({ input: item, id: item.id })}>
                            <span className="font-strong">{item.name}</span>
                            <span className="truncate text-sm text-muted">{t('settings.unit_summary', { symbol: item.symbol, decimals: item.decimals })}</span>
                        </button>
                        <span className="hidden text-right sm:block">{item.code ? <code className="rounded-sm bg-surface-2 px-1 font-mono text-xs">{item.code}</code> : <Tag tone="bad">{t('settings.unit_no_code')}</Tag>}</span>
                        <span className="hidden sm:block" />
                    </>
                )}
                onEdit={(item) => setUnit({ input: item, id: item.id })}
                onArchive={(item) => void archiveWithUndo(item.name, () => archiveUnit(item.id), () => restoreUnit(item.id))}
                onRestore={(item) => void restoreUnit(item.id).catch((error: unknown) => toast.error(errorMessage(error)))}
                label={(item) => item.name}
            />
            {rate && <TaxRateDrawer initial={rate.input} id={rate.id} onClose={() => setRate(null)} />}
            {unit && <UnitDrawer initial={unit.input} id={unit.id} onClose={() => setUnit(null)} />}
        </div>
    );
}

type SectionProps<T extends { id: string; archived_at: string | null }> = {
    title: string;
    description: string;
    action: ReactNode;
    query: { data?: T[]; error?: unknown; mutate(): unknown };
    empty: ReactNode;
    render(item: T): ReactNode;
    onEdit(item: T): void;
    onArchive(item: T): void;
    onRestore(item: T): void;
    label(item: T): string;
};

function Section<T extends { id: string; archived_at: string | null }>({ title, description, action, query, empty, render, onEdit, onArchive, onRestore, label }: SectionProps<T>) {
    const [showArchived, setShowArchived] = useState(false);
    const active = (query.data ?? []).filter((item) => item.archived_at === null);
    const archived = (query.data ?? []).filter((item) => item.archived_at !== null);

    return (
        <SettingsCard flush>
            <div className="px-5 pt-5">
                <CardHead title={title} description={description} actions={action} />
            </div>
            {query.error ? (
                <ErrorState error={query.error} onRetry={() => void query.mutate()} />
            ) : !query.data ? (
                <ListSkeleton rows={3} />
            ) : active.length === 0 ? (
                empty
            ) : (
                <ul className="m-0 grid list-none gap-0.5 px-2 pb-2">
                    {active.map((item) => (
                        <li key={item.id} className={ROW}>
                            {render(item)}
                            <span className="row-span-2 flex justify-end gap-0.5 sm:row-span-1">
                                <Button variant="ghost" size="sm" iconOnly icon={<Pencil />} onClick={() => onEdit(item)}>
                                    {t('settings.edit_named', { label: label(item) })}
                                </Button>
                                <Button variant="ghost" size="sm" iconOnly icon={<Archive />} onClick={() => onArchive(item)}>
                                    {t('settings.archive_named', { label: label(item) })}
                                </Button>
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            {archived.length > 0 && (
                <div className="border-t border-surface-2 px-2 pt-1 pb-2">
                    <button type="button" aria-expanded={showArchived} onClick={() => setShowArchived(!showArchived)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted hover:text-ink">
                        {tn('settings.archived_count', archived.length)}
                        <ChevronDown aria-hidden className={cx('ml-auto size-4 transition-transform', showArchived && 'rotate-180')} />
                    </button>
                    {showArchived && (
                        <ul className="m-0 grid list-none gap-0.5 p-0">
                            {archived.map((item) => (
                                <li key={item.id} className={cx(ROW, 'opacity-70')}>
                                    {render(item)}
                                    <span className="row-span-2 flex justify-end sm:row-span-1">
                                        <Button variant="ghost" size="sm" icon={<RotateCcw />} onClick={() => onRestore(item)}>
                                            {t('settings.restore')}
                                        </Button>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </SettingsCard>
    );
}
