import type { Totals } from '@/api/types';
import { cx } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';
import { formatDecimalInput, isZeroDecimal } from '../decimal';

function Row({ label, value, sub = false }: { label: string; value: string; sub?: boolean }) {
    return (
        <div className={cx('flex justify-between gap-4', sub && 'text-sm text-muted')}>
            <span>{label}</span>
            <span className="num">{value}</span>
        </div>
    );
}

/** Net, VAT per rate, total, optional positions and legal notes – exactly as the server calculated them. */
/** stale: the last render request failed, so these totals belong to an earlier state of the draft (dimmed, aria-busy). */
export function TotalsPanel({ totals, stale = false }: { totals: Totals | null; stale?: boolean }) {
    if (!totals) return null;
    return (
        <div role="group" aria-label={t('editor.totals')} aria-busy={stale || undefined} className={cx('mt-2 ml-auto grid w-full max-w-96 gap-1.5 rounded-lg bg-bg px-5 py-4 transition-opacity', stale && 'opacity-55')}>
            <Row label={t('editor.net')} value={formatMoney(totals.net)} />
            {totals.tax_breakdown.map((row) => (
                <Row
                    key={`${row.category}:${row.percent}`}
                    sub
                    label={
                        row.category === 'S'
                            ? t('editor.tax_line', { percent: formatDecimalInput(row.percent), net: formatMoney(row.net) })
                            : t('editor.tax_exempt_line', { label: t(`editor.tax_category.${row.category.toLowerCase()}`), net: formatMoney(row.net) })
                    }
                    value={formatMoney(row.tax)}
                />
            ))}
            <div className="mt-2 flex justify-between gap-4 pt-3 text-xl font-bold tracking-tight shadow-[inset_0_1px_0_var(--surface-3)]">
                <span>{t('editor.gross')}</span>
                <span className="num">{formatMoney(totals.gross)}</span>
            </div>
            {!isZeroDecimal(totals.optional_net) && <Row sub label={t('editor.optional_total')} value={formatMoney(totals.optional_net)} />}
            {totals.missing_tax_rate.length > 0 && <p className="text-xs text-muted">{t('editor.missing_tax_rate')}</p>}
            {totals.legal_notes.map((note) => (
                <p key={note} className="mt-1 text-xs text-muted">
                    {note}
                </p>
            ))}
        </div>
    );
}
