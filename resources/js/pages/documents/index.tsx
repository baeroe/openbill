import { Head, Link, router } from '@inertiajs/react';
import { FileText, Plus, SearchX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useDocumentList } from '@/api/documents';
import type { DocumentFilters, DocumentStatus, DocumentSummary, DocumentType } from '@/api/types';
import { useNewDocument } from '@/components/new-document/new-document-context';
import { Button, Card, cx, EmptyState, ErrorState, ListSkeleton, Page, PageHeader, PillButton, SearchInput, SelectControl, StatusBadge } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { formatDate, formatMoney, formatMonth, groupByMonth } from '@/lib/format';
import { useDebounced } from '@/lib/hooks';
import { path, t, tn } from '@/lib/i18n';
import { usePendingDeletes } from '@/lib/pending-delete';

type Filters = { type: DocumentType | null; status: DocumentFilters['status']; customer_id: string | null; q: string | null };

type Props = {
    filters: Filters;
    counts: Record<'all' | DocumentType, number>;
    summary: { count: number; gross_total: string };
    customers: { id: string; name: string }[];
};

const TYPE_PILLS: { value: DocumentType | null; key: 'all' | DocumentType }[] = [
    { value: null, key: 'all' },
    { value: 'offer', key: 'offer' },
    { value: 'confirmation', key: 'confirmation' },
    { value: 'invoice', key: 'invoice' },
    { value: 'cancellation', key: 'cancellation' },
];

const STATUS_OPTIONS: (DocumentStatus | 'overdue')[] = ['draft', 'open', 'overdue', 'accepted', 'rejected', 'done', 'paid', 'cancelled', 'closed'];

/** Number · customer · date · due/valid until · status · amount; on phones two lines (customer/amount, number/status). */
const GRID = 'grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[8rem_minmax(0,1fr)_6.5rem_7.5rem_7rem] lg:grid-cols-[8.5rem_minmax(0,1fr)_5.5rem_6.5rem_7.5rem_7rem]';

const EMPTY: Filters = { type: null, status: null, customer_id: null, q: null };

export default function Documents({ filters, counts, summary, customers }: Props) {
    const openNewDocument = useNewDocument();
    const [query, setQuery] = useState(filters.q ?? '');
    const search = useDebounced(query, 300);
    const list = useDocumentList(filters);
    // drafts deleted in the editor disappear at once; the DELETE follows when their undo toast is gone
    const removed = usePendingDeletes();
    const items = list.items.filter((row) => !removed.has(row.id));
    const groups = groupByMonth(items);
    const filtered = Boolean(filters.type || filters.status || filters.customer_id || filters.q);

    // the URL is the state: every change is an Inertia visit that also brings fresh counts and sum
    // pills and selects add a history entry (back restores the previous filter); typing replaces it
    const visit = (next: Filters, replace = false) => {
        const params = Object.fromEntries(Object.entries(next).filter(([, value]) => value));
        router.get(path('/documents'), params, { preserveState: true, preserveScroll: true, replace, only: ['filters', 'counts', 'summary'] });
    };
    // The filters asked for last. The `filters` prop stays old until the answer arrives, and Inertia cancels a
    // running visit when the next one starts: merging into the prop would drop a change made in between.
    const requested = useRef<Filters>(filters);
    useEffect(() => {
        requested.current = filters;
    }, [filters]);
    // the search always goes along as typed, so a pill clicked during typing keeps it
    const set = (patch: Partial<Filters>, replace = false) => {
        requested.current = { ...requested.current, q: query.trim() || null, ...patch };
        visit(requested.current, replace);
    };
    const reset = () => {
        setQuery('');
        requested.current = EMPTY;
        visit(EMPTY);
    };
    const newDocument = () =>
        openNewDocument({ type: filters.type && filters.type !== 'cancellation' ? filters.type : undefined, customerId: filters.customer_id ?? undefined });

    // the search goes into the URL once typing pauses
    useEffect(() => {
        const q = search.trim() || null;
        if (q !== requested.current.q) set({ q }, true);
    }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

    // back/forward in the browser changes the URL: the field follows. Compared with the debounced text, so an
    // answer to an older search never overwrites what is being typed right now.
    useEffect(() => {
        if ((filters.q ?? '') !== search.trim()) setQuery(filters.q ?? '');
    }, [filters.q]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <Page>
            <Head title={t('nav.documents')} />
            <PageHeader
                title={t('nav.documents')}
                description={t('documents.description')}
                actions={
                    <Button variant="primary" icon={<Plus />} onClick={newDocument}>
                        {t('shell.new_document')}
                    </Button>
                }
            />

            <div className="grid gap-3">
                <div role="group" aria-label={t('documents.filter_type')} className="flex flex-wrap gap-1">
                    {TYPE_PILLS.map((pill) => (
                        <PillButton key={pill.key} pressed={filters.type === pill.value} count={counts[pill.key]} onClick={() => set({ type: pill.value })}>
                            {t(`documents.type_${pill.key}`)}
                        </PillButton>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <SearchInput
                        className="max-w-[26rem] flex-[1_1_18rem]"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t('documents.search')}
                        aria-label={t('documents.search_label')}
                    />
                    <SelectControl
                        className="flex-[1_1_10rem] sm:flex-[0_1_13rem]"
                        value={filters.status ?? ''}
                        onChange={(e) => set({ status: (e.target.value || null) as Filters['status'] })}
                        aria-label={t('documents.filter_status')}
                    >
                        <option value="">{t('documents.any_status')}</option>
                        {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                                {t(`status.${status}`)}
                            </option>
                        ))}
                    </SelectControl>
                    <SelectControl
                        className="flex-[1_1_10rem] sm:flex-[0_1_13rem]"
                        value={filters.customer_id ?? ''}
                        onChange={(e) => set({ customer_id: e.target.value || null })}
                        aria-label={t('documents.filter_customer')}
                    >
                        <option value="">{t('documents.all_customers')}</option>
                        {customers.map((customer) => (
                            <option key={customer.id} value={customer.id}>
                                {customer.name}
                            </option>
                        ))}
                    </SelectControl>
                    {filtered && (
                        <Button variant="ghost" size="sm" onClick={reset}>
                            {t('documents.reset')}
                        </Button>
                    )}
                </div>
            </div>

            <Card tinted flush className="p-2" aria-busy={list.isLoading || list.isLoadingMore}>
                {list.error ? (
                    <ErrorState error={list.error} onRetry={list.retry} />
                ) : list.isLoading ? (
                    <ListSkeleton rows={7} />
                ) : items.length === 0 ? (
                    filtered ? (
                        <EmptyState icon={<SearchX />} title={t('documents.none_found')} actions={<Button onClick={reset}>{t('documents.reset')}</Button>}>
                            {t('documents.none_found_text')}
                        </EmptyState>
                    ) : (
                        <EmptyState
                            icon={<FileText />}
                            title={t('documents.empty')}
                            actions={
                                <Button variant="primary" icon={<Plus />} onClick={newDocument}>
                                    {t('documents.first')}
                                </Button>
                            }
                        >
                            {t('documents.empty_text')}
                        </EmptyState>
                    )
                ) : (
                    <div className="animate-fade-in">
                        <div aria-hidden className={cx('hidden gap-4 px-5 py-2 text-xs font-medium text-muted sm:grid', GRID)}>
                            <span>{t('documents.col_number')}</span>
                            <span>{t('documents.col_customer')}</span>
                            <span className="hidden lg:block">{t('documents.col_date')}</span>
                            <span>{t('documents.col_deadline')}</span>
                            <span>{t('documents.col_status')}</span>
                            <span className="text-right">{t('documents.col_amount')}</span>
                        </div>
                        {groups.map((group) => (
                            <section key={group.key} aria-label={formatMonth(group.key)}>
                                <h2 className="px-5 pt-4 pb-1 text-sm font-semibold tracking-[-0.01em] text-muted">{formatMonth(group.key)}</h2>
                                <div className="grid">
                                    {group.items.map((document) => (
                                        <DocumentRow key={document.id} document={document} />
                                    ))}
                                </div>
                            </section>
                        ))}
                        {list.hasMore && (
                            <div className="flex justify-center pt-3">
                                <Button size="sm" pending={list.isLoadingMore} onClick={list.loadMore}>
                                    {t('documents.load_more')}
                                </Button>
                            </div>
                        )}
                        <div className="flex justify-between gap-4 px-5 pt-4 pb-3 text-sm text-muted">
                            <span>{tn('documents.count', summary.count)}</span>
                            <span className="num">{t('documents.sum', { amount: formatMoney(summary.gross_total) })}</span>
                        </div>
                    </div>
                )}
            </Card>
        </Page>
    );
}

Documents.layout = appLayout;

function DocumentRow({ document }: { document: DocumentSummary }) {
    const deadline = document.type === 'invoice' ? document.due_date : document.type === 'offer' ? document.valid_until : null;

    return (
        <Link
            href={path(`/documents/${document.id}`)}
            className={cx('grid min-h-14 items-center gap-x-4 gap-y-1 rounded-md px-4 py-3 text-inherit no-underline transition-colors hover:bg-surface-2 sm:gap-4 sm:px-5', GRID)}
        >
            <span className="col-start-1 row-start-2 flex min-w-0 items-baseline gap-2 sm:col-auto sm:row-auto sm:grid sm:gap-px">
                <span className={cx('whitespace-nowrap', document.number ? 'num font-semibold' : 'font-semibold text-muted italic')}>{document.number ?? t('documents.draft')}</span>
                <span className="truncate text-sm text-muted">{t(`document_type.${document.type}`)}</span>
            </span>
            <span className="col-start-1 row-start-1 min-w-0 truncate font-strong sm:col-auto sm:row-auto">{document.customer_name ?? t('documents.no_customer')}</span>
            <span className="num hidden text-sm text-muted lg:block">{formatDate(document.date)}</span>
            <span className={cx('num hidden text-sm sm:block', document.is_overdue ? 'font-semibold text-bad' : 'text-muted')}>{deadline ? formatDate(deadline) : '–'}</span>
            <span className="col-start-2 row-start-2 justify-self-end sm:col-auto sm:row-auto sm:justify-self-start">
                <StatusBadge status={document.status} overdue={document.is_overdue} />
            </span>
            <span className="num col-start-2 row-start-1 text-right font-semibold sm:col-auto sm:row-auto">{formatMoney(document.gross_total)}</span>
        </Link>
    );
}
