import { formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';

type Props = { gross: string; open?: string | null };

/**
 * Gross total of a document; for an invoice with partial cancellations also what is left of it
 * (open_amount of the API, computed on the server – never in the browser).
 */
export function DocumentAmount({ gross, open }: Props) {
    const partial = open !== null && open !== undefined && open !== gross && open !== '0.00';
    return (
        <>
            {formatMoney(gross)}
            {partial && <span className="block text-xs font-normal text-muted">{t('documents.after_cancellations', { amount: formatMoney(open) })}</span>}
        </>
    );
}
