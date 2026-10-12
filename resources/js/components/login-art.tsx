import { Check, FileCheck2, FileCode2 } from 'lucide-react';
import { Fragment, type CSSProperties } from 'react';
import { formatMoney, formatPercent } from '@/lib/format';
import { t } from '@/lib/i18n';

/** Stagger of an animated element (resources/css/login.css reads --step). */
const step = (index: number) => ({ '--step': index }) as CSSProperties;

const CHAIN = ['offer', 'confirmation', 'invoice'] as const;

/** Fictional demo invoice in the UI language (the numbers of the docs landing page): 890.00 + 3 × 760.00 + 52 × 95.00 = 8,110.00 net. */
const groups = () => [
    {
        title: 'login.art.group_concept',
        rows: [
            { name: 'login.art.item_workshop', meta: t('login.art.qty_once', { price: formatMoney('890.00') }), amount: '890.00' },
            { name: 'login.art.item_wireframes', meta: t('login.art.qty_days', { count: 3, price: formatMoney('760.00') }), amount: '2280.00' },
        ],
    },
    {
        title: 'login.art.group_build',
        rows: [{ name: 'login.art.item_frontend', meta: t('login.art.qty_hours', { count: 52, price: formatMoney('95.00') }), amount: '4940.00' }],
    },
];

/**
 * Decorative illustration of the login page: the document chain steps through to the invoice, the invoice gets its
 * number, a "paid" stamp settles and the two archive files appear. Plays once (~2 s, login.css); with reduced motion
 * it shows the final state right away. The paper stays white in dark mode (DESIGN.md: it shows the printed PDF).
 */
export function LoginArt() {
    return (
        <div aria-hidden className="login-art grid w-full max-w-[29rem] gap-5">
            <div className="flex items-center gap-1.5 text-xs font-strong">
                {CHAIN.map((type, index) => {
                    const current = index === CHAIN.length - 1;
                    return (
                        <Fragment key={type}>
                            {index > 0 && <span className="login-link h-0.5 min-w-3 flex-1 basis-0 rounded-full bg-surface-3" style={step(index)} />}
                            <span className={current ? 'login-step login-step-current' : 'login-step'} style={step(index)}>
                                {!current && <Check className="login-check size-3.5 text-ok" strokeWidth={2.5} />}
                                <span className="truncate">{t(`document_type.${type}`)}</span>
                            </span>
                        </Fragment>
                    );
                })}
            </div>

            <div className="login-paper relative grid gap-5 rounded-[6px] p-7 text-xs shadow-paper">
                <div className="grid gap-3">
                    <span className="text-[11px] text-[var(--paper-muted)]">Studio Nordlicht</span>
                    <div className="flex items-baseline justify-between gap-4">
                        <span className="text-xl font-bold tracking-heading">{t('document_type.invoice')}</span>
                        <span className="num grid justify-items-end font-strong">
                            <span className="login-draft col-start-1 row-start-1 text-[var(--paper-muted)]">{t('template.draft')}</span>
                            <span className="login-number col-start-1 row-start-1">{t('login.art.number')}</span>
                        </span>
                    </div>
                    <span className="text-[var(--paper-muted)]">
                        {t('template.for')} <span className="font-strong text-[var(--paper-ink)]">Hafenkontor Lindqvist GmbH</span>
                    </span>
                </div>

                {groups().map((group) => (
                    <div key={group.title} className="grid gap-2 border-t border-[var(--paper-line)] pt-3">
                        <span className="font-heading">{t(group.title)}</span>
                        {group.rows.map((row) => (
                            <div key={row.name} className="flex items-baseline justify-between gap-4">
                                <span className="grid">
                                    <span>{t(row.name)}</span>
                                    <span className="num text-[11px] text-[var(--paper-muted)]">{row.meta}</span>
                                </span>
                                <span className="num">{formatMoney(row.amount)}</span>
                            </div>
                        ))}
                    </div>
                ))}

                <div className="num ml-auto grid w-[58%] gap-1.5">
                    <div className="flex justify-between px-3 text-[var(--paper-muted)]">
                        <span>{t('template.net')}</span>
                        <span>{formatMoney('8110.00')}</span>
                    </div>
                    <div className="flex justify-between px-3 text-[var(--paper-muted)]">
                        <span>
                            {t('template.vat')} {formatPercent('19.00')}
                        </span>
                        <span>{formatMoney('1540.90')}</span>
                    </div>
                    <div className="flex justify-between rounded-[10px] bg-[var(--paper-accent-soft)] px-3 py-2 text-sm font-bold text-[var(--paper-accent)]">
                        <span>{t('template.total')}</span>
                        <span>{formatMoney('9650.90')}</span>
                    </div>
                </div>

                <span className="login-stamp absolute bottom-[9%] left-[9%] rounded-[8px] border-2 border-current px-3 py-0.5 text-xl font-bold tracking-heading text-[var(--paper-ok)]">
                    {t('status.paid')}
                </span>
            </div>

            <div className="relative z-10 -mt-[2.375rem] mr-[-5%] flex justify-end gap-2">
                <span className="login-file" style={step(0)}>
                    <FileCheck2 className="size-4 text-accent" />
                    PDF/A-3
                </span>
                <span className="login-file" style={step(1)}>
                    <FileCode2 className="size-4 text-accent" />
                    {t('editor.e_invoice')}
                    <span className="font-normal text-muted">factur-x.xml</span>
                </span>
            </div>
        </div>
    );
}
