import { Head, Link, usePage } from '@inertiajs/react';
import { AlarmClock, ArrowUpRight, CircleCheck, FilePen, FilePlus2, FileText, Hourglass, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DocumentStatus, DocumentType } from '@/api/types';
import { DocumentAmount } from '@/components/document-amount';
import { useNewDocument } from '@/components/new-document/new-document-context';
import { Badge, Button, Card, CardHead, cx, EmptyState, Page, StatusBadge } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { formatDate, formatLongDate, formatMoney, monthName, relativeDays } from '@/lib/format';
import { path, t, tn } from '@/lib/i18n';
import type { SharedProps } from '@/types';

type Figure = { gross: string; count: number };
type Reason = 'overdue' | 'offer_expired' | 'offer_expiring' | 'draft';

/** One row of App\Support\Overview. */
export type OverviewDocument = {
    id: string;
    type: DocumentType;
    status: DocumentStatus;
    number: string | null;
    customer_name: string | null;
    gross_total: string;
    open_amount: string | null;
    is_overdue: boolean;
    reason: Reason | null;
    reason_date: string | null;
};

export type OverviewData = {
    figures: { open: Figure; overdue: Figure; offers: Figure; paid_month: Figure; paid_year: Figure };
    attention: OverviewDocument[];
    attention_count: number;
    recent: OverviewDocument[];
};

const ATTENTION: Record<Reason, { icon: LucideIcon; tone: string }> = {
    overdue: { icon: AlarmClock, tone: 'bg-bad-soft text-bad' },
    offer_expired: { icon: Hourglass, tone: 'bg-warn-soft text-warn' },
    offer_expiring: { icon: Hourglass, tone: 'bg-warn-soft text-warn' },
    draft: { icon: FilePen, tone: 'bg-surface-2 text-muted' },
};

const ROW = 'grid min-h-14 items-center gap-4 rounded-md px-3 py-2 text-inherit no-underline transition-colors hover:bg-surface';

function greeting(name: string, hour: number): string {
    if (hour < 11) return t('overview.greeting_morning', { name });
    if (hour < 18) return t('overview.greeting_day', { name });
    return t('overview.greeting_evening', { name });
}

function attentionText(document: OverviewDocument, today: string): string {
    const date = document.reason_date ?? today;
    switch (document.reason) {
        case 'overdue':
            return t('overview.due', { when: relativeDays(date, today) });
        case 'offer_expired':
            return t('overview.offer_expired');
        case 'offer_expiring':
            return t('overview.offer_valid', { date: formatDate(date), when: relativeDays(date, today) });
        default:
            return t('overview.draft_changed', { when: relativeDays(date, today) });
    }
}

/** `today` is the server's date (YYYY-MM-DD): the figures, the month name and the relative days all refer to it. */
export default function Overview({ overview, today }: { overview: OverviewData; today: string }) {
    const { auth } = usePage<SharedProps>().props;
    const openNewDocument = useNewDocument();
    // the greeting follows the clock of the person in front of the screen, dates follow the figures
    const hour = new Date().getHours();
    const day = new Date(`${today}T12:00:00`);
    const firstName = (auth.user?.name ?? '').split(' ')[0];
    const { figures, attention, attention_count: attentionCount, recent } = overview;

    return (
        <Page className="gap-8">
            <Head title={t('nav.overview')} />
            <header className="flex flex-wrap items-end gap-4">
                <div className="grid min-w-0 gap-1">
                    <h1 className="text-3xl font-bold tracking-brand">{greeting(firstName, hour)}</h1>
                    <p className="text-muted first-letter:uppercase">{formatLongDate(day)}</p>
                </div>
                <div className="flex flex-wrap gap-3 sm:ml-auto">
                    <Button icon={<FilePlus2 />} onClick={() => openNewDocument({ type: 'offer' })}>
                        {t('overview.new_offer')}
                    </Button>
                    <Button variant="primary" icon={<FileText />} onClick={() => openNewDocument({ type: 'invoice' })}>
                        {t('overview.new_invoice')}
                    </Button>
                </div>
            </header>

            <section aria-label={t('overview.figures')} className="grid gap-2 xs:grid-cols-2 lg:grid-cols-4">
                <FigureTile
                    label={t('overview.open_invoices')}
                    value={formatMoney(figures.open.gross)}
                    note={tn('overview.open_invoices_note', figures.open.count)}
                    href={path('/documents?type=invoice&status=open')}
                />
                <FigureTile
                    label={t('overview.overdue')}
                    value={formatMoney(figures.overdue.gross)}
                    bad={figures.overdue.count > 0}
                    note={figures.overdue.count > 0 ? tn('overview.overdue_note', figures.overdue.count) : t('overview.on_time')}
                    href={figures.overdue.count > 0 ? path('/documents?type=invoice&status=overdue') : undefined}
                />
                <FigureTile
                    label={t('overview.open_offers')}
                    value={formatMoney(figures.offers.gross)}
                    note={tn('overview.open_offers_note', figures.offers.count)}
                    href={path('/documents?type=offer&status=open')}
                />
                <FigureTile
                    label={t('overview.paid_month', { month: monthName(day) })}
                    value={formatMoney(figures.paid_month.gross)}
                    // no link: the document list has no date filter yet, it would show the paid invoices of every month
                    note={t('overview.paid_year', { amount: formatMoney(figures.paid_year.gross) })}
                />
            </section>

            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                <Card tinted flush className="px-3 pt-5 pb-3" aria-labelledby="overview-attention">
                    <div className="px-2">
                        <CardHead
                            titleId="overview-attention"
                            title={
                                // the count sits next to the title, as in the clickdummy
                                <span className="flex items-center gap-2">
                                    {t('overview.attention')}
                                    {attentionCount > 0 && <Badge plain>{attentionCount}</Badge>}
                                </span>
                            }
                        />
                    </div>
                    {attention.length === 0 ? (
                        <EmptyState icon={<CircleCheck />} title={t('overview.nothing_to_do')}>
                            {t('overview.nothing_to_do_text')}
                        </EmptyState>
                    ) : (
                        <div className="grid animate-fade-in">
                            {attention.map((document) => (
                                <AttentionRow key={document.id} document={document} today={today} />
                            ))}
                            {attentionCount > attention.length && <p className="px-3 pt-2 text-sm text-muted">{t('overview.attention_more', { count: attentionCount - attention.length })}</p>}
                        </div>
                    )}
                </Card>

                <Card tinted flush className="px-3 pt-5 pb-3" aria-labelledby="overview-recent">
                    <div className="px-2">
                        <CardHead
                            titleId="overview-recent"
                            title={t('overview.recent')}
                            actions={
                                <Link href={path('/documents')} className="inline-flex items-center gap-0.5 text-sm font-strong text-accent no-underline hover:underline [&_svg]:size-[0.9rem]">
                                    {t('overview.all_documents')}
                                    <ArrowUpRight aria-hidden />
                                </Link>
                            }
                        />
                    </div>
                    {recent.length === 0 ? (
                        <EmptyState
                            icon={<FileText />}
                            title={t('overview.no_documents')}
                            actions={
                                <Button variant="primary" onClick={() => openNewDocument({ type: 'offer' })}>
                                    {t('overview.first_offer')}
                                </Button>
                            }
                        >
                            {t('overview.no_documents_text')}
                        </EmptyState>
                    ) : (
                        <div className="grid animate-fade-in">
                            {recent.map((document) => (
                                <RecentRow key={document.id} document={document} />
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </Page>
    );
}

Overview.layout = appLayout;

function FigureTile({ label, value, note, href, bad = false }: { label: string; value: string; note: string; href?: string; bad?: boolean }) {
    const body: ReactNode = (
        <>
            <span className="text-sm font-medium text-muted">{label}</span>
            <span className={cx('num text-2xl font-heading tracking-[-0.03em]', bad && 'text-bad')}>{value}</span>
            <span className="text-xs text-muted">{note}</span>
        </>
    );
    const className = 'grid content-start gap-1 rounded-lg bg-surface-2 p-5 text-inherit no-underline transition-colors';

    return href ? (
        <Link href={href} className={cx(className, 'hover:bg-surface-3')}>
            {body}
        </Link>
    ) : (
        <div className={className}>{body}</div>
    );
}

function AttentionRow({ document, today }: { document: OverviewDocument; today: string }) {
    const { icon: Icon, tone } = ATTENTION[document.reason ?? 'draft'];
    return (
        <Link href={path(`/documents/${document.id}`)} className={cx(ROW, 'grid-cols-[2rem_minmax(0,1fr)_auto]')}>
            <span className={cx('grid size-8 place-items-center rounded-full [&_svg]:size-4', tone)}>
                <Icon aria-hidden />
            </span>
            <span className="grid min-w-0 gap-px">
                <span className="truncate font-strong">
                    {document.number ?? t(`document_type.${document.type}`)} · {document.customer_name ?? t('documents.no_customer')}
                </span>
                <span className="truncate text-sm text-muted">{attentionText(document, today)}</span>
            </span>
            <span className="num text-right font-semibold whitespace-nowrap">
                <DocumentAmount gross={document.gross_total} open={document.open_amount} />
            </span>
        </Link>
    );
}

function RecentRow({ document }: { document: OverviewDocument }) {
    return (
        <Link href={path(`/documents/${document.id}`)} className={cx(ROW, 'grid-cols-[minmax(0,1fr)_auto] xs:grid-cols-[minmax(0,1fr)_auto_6.5rem]')}>
            <span className="grid min-w-0 gap-px">
                <span className="truncate font-strong">{document.customer_name ?? t('documents.no_customer')}</span>
                <span className="truncate text-sm text-muted">
                    {t(`document_type.${document.type}`)} {document.number ?? t('overview.draft_label')}
                </span>
            </span>
            <span className="hidden xs:block">
                <StatusBadge status={document.status} overdue={document.is_overdue} />
            </span>
            <span className="num text-right font-semibold whitespace-nowrap">
                <DocumentAmount gross={document.gross_total} open={document.open_amount} />
            </span>
        </Link>
    );
}
