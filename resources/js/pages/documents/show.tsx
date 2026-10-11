import { Head } from '@inertiajs/react';
import { FileDown, Info } from 'lucide-react';
import { useDocument } from '@/api/documents';
import { BackLink, buttonClass, Card, ErrorState, Notice, Page, Skeleton, StatusBadge } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { formatDate, formatMoney } from '@/lib/format';
import { path, t } from '@/lib/i18n';

/** Read-only summary of a document. Phase 6 replaces this page with the editor (same route, same prop). */
export default function DocumentPage({ document_id: id }: { document_id: string }) {
    const { data: document, error, mutate } = useDocument(id);
    const title = document ? `${t(`document_type.${document.type}`)} ${document.number ?? t('overview.draft_label')}` : t('nav.documents');

    return (
        <Page>
            <Head title={title} />
            <BackLink href={path('/documents')}>{t('document_page.back')}</BackLink>
            {error ? (
                <ErrorState error={error} onRetry={() => void mutate()} />
            ) : !document ? (
                <div className="grid gap-4" aria-busy="true" aria-label={t('common.loading')}>
                    <Skeleton w="40%" h={34} />
                    <Skeleton h={120} r={18} />
                </div>
            ) : (
                <>
                    <header className="flex flex-wrap items-end gap-4">
                        <div className="grid min-w-0 gap-1">
                            <h1 className="text-2xl font-bold tracking-title sm:text-3xl">{title}</h1>
                            <p className="text-muted">{document.customer_name ?? t('documents.no_customer')}</p>
                        </div>
                        <div className="ml-auto flex items-center gap-3">
                            <StatusBadge status={document.status} overdue={document.is_overdue} />
                            {/* same-origin link: the browser sends the session cookie and the Referer Sanctum needs */}
                            <a className={buttonClass({ variant: 'primary' })} href={`/api/documents/${document.id}/pdf?inline=1`} target="_blank" rel="noopener">
                                <FileDown aria-hidden />
                                {t('document_page.pdf')}
                            </a>
                        </div>
                    </header>
                    <Card tinted>
                        <dl className="grid gap-4 sm:grid-cols-3">
                            <Fact label={t('documents.col_date')} value={formatDate(document.date)} />
                            <Fact label={t('documents.col_deadline')} value={formatDate(document.type === 'offer' ? document.valid_until : document.due_date) || '–'} />
                            <Fact label={t('documents.col_amount')} value={formatMoney(document.gross_total)} />
                        </dl>
                    </Card>
                    <Notice icon={<Info />}>{t('document_page.read_only_hint')}</Notice>
                </>
            )}
        </Page>
    );
}

DocumentPage.layout = appLayout;

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid gap-1">
            <dt className="text-sm font-medium text-muted">{label}</dt>
            <dd className="num text-lg font-heading">{value}</dd>
        </div>
    );
}
