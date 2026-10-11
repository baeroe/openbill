import { Head, Link } from '@inertiajs/react';
import { Plus, Search, Users } from 'lucide-react';
import { useState } from 'react';
import { useCustomerList } from '@/api/customers';
import type { Customer } from '@/api/types';
import { Avatar, Badge, Button, ButtonLink, Card, cx, EmptyState, ErrorState, Page, PageHeader, SearchInput, Skeleton, Tag } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { contactName, defaultContact, taxTag } from '@/lib/customers';
import { countryName, formatMoney } from '@/lib/format';
import { useDebounced } from '@/lib/hooks';
import { path, t, tn } from '@/lib/i18n';

type OpenSum = { gross: string; count: number; overdue: number };

/** Avatar · name · city · contact · open; below 900 px only avatar, name and open. */
const COLUMNS = 'grid-cols-[2.5rem_minmax(0,1fr)_auto] md:grid-cols-[2.5rem_minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(7rem,auto)]';

export default function Customers({ open_by_customer: openByCustomer }: { open_by_customer: Record<string, OpenSum> }) {
    const [query, setQuery] = useState('');
    const search = useDebounced(query, 250);
    const list = useCustomerList(search);
    const newButton = (
        <ButtonLink href={path('/customers/new')} variant="primary" icon={<Plus />}>
            {t('customers.new')}
        </ButtonLink>
    );

    return (
        <Page>
            <Head title={t('nav.customers')} />
            <PageHeader title={t('nav.customers')} description={t('customers.description')} actions={newButton} />

            <div className="flex flex-wrap items-center gap-3">
                <SearchInput className="w-full max-w-[22rem]" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('customers.search')} aria-label={t('customers.search_label')} />
                {!list.isLoading && !list.error && <span className="text-sm text-muted">{tn('customers.count', list.total)}</span>}
            </div>

            <Card flush aria-busy={list.isLoading || list.isLoadingMore}>
                {list.error ? (
                    <ErrorState error={list.error} onRetry={list.retry} />
                ) : list.isLoading ? (
                    <ListLoading />
                ) : list.items.length === 0 ? (
                    search.trim() ? (
                        <EmptyState icon={<Search />} title={t('customers.none_found')}>
                            {t('customers.none_found_text', { q: search.trim() })}
                        </EmptyState>
                    ) : (
                        <EmptyState icon={<Users />} title={t('customers.empty')} actions={newButton}>
                            {t('customers.empty_text')}
                        </EmptyState>
                    )
                ) : (
                    <>
                        <div aria-hidden className={cx('hidden gap-4 px-6 pt-2 text-xs font-medium text-muted md:grid', COLUMNS)}>
                            <span />
                            <span>{t('customers.col_customer')}</span>
                            <span>{t('customers.col_city')}</span>
                            <span>{t('customers.col_contact')}</span>
                            <span className="text-right">{t('customers.col_open')}</span>
                        </div>
                        <div className="grid animate-fade-in gap-0.5 p-2">
                            {list.items.map((customer) => (
                                <CustomerRow key={customer.id} customer={customer} open={openByCustomer[customer.id]} />
                            ))}
                        </div>
                        {list.hasMore && (
                            <div className="flex justify-center pb-4">
                                <Button size="sm" pending={list.isLoadingMore} onClick={list.loadMore}>
                                    {t('documents.load_more')}
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </Card>
        </Page>
    );
}

Customers.layout = appLayout;

function CustomerRow({ customer, open }: { customer: Customer; open?: OpenSum }) {
    const contact = defaultContact(customer.contacts);
    const tag = taxTag(customer.tax_treatment);

    return (
        <Link href={path(`/customers/${customer.id}`)} className={cx('grid items-center gap-4 rounded-md px-4 py-3 text-inherit no-underline transition-colors hover:bg-surface-2', COLUMNS)}>
            <Avatar name={customer.name} tone="accent" />
            <span className="grid min-w-0 gap-0.5">
                <span className="flex min-w-0 items-center gap-2">
                    <strong className="truncate font-semibold">{customer.name}</strong>
                    {tag && (
                        // hidden on phones: next to a long name it would squeeze the name to one letter
                        <span className="hidden sm:contents">
                            <Tag neutral>{tag}</Tag>
                        </span>
                    )}
                </span>
                <span className="truncate text-sm text-muted">{customer.number}</span>
            </span>
            <span className="hidden min-w-0 gap-0.5 md:grid">
                <span className="truncate">{customer.city || t('customers.no_city')}</span>
                <span className="truncate text-sm text-muted">{countryName(customer.country)}</span>
            </span>
            <span className="hidden min-w-0 gap-0.5 md:grid">
                <span className="truncate">{contact ? contactName(contact, false) || t('contact.no_name') : t('customers.no_contact')}</span>
                <span className="truncate text-sm text-muted">{contact?.position || contact?.email || ' '}</span>
            </span>
            <span className="grid justify-items-end gap-0.5 text-right">
                {open ? (
                    <>
                        <strong className="num font-semibold">{formatMoney(open.gross)}</strong>
                        {open.overdue > 0 ? <Badge tone="bad">{t('customers.overdue', { count: open.overdue })}</Badge> : <span className="text-sm text-muted">{tn('customers.open_invoices', open.count)}</span>}
                    </>
                ) : (
                    <span className="text-sm text-muted">{t('customers.nothing_open')}</span>
                )}
            </span>
        </Link>
    );
}

function ListLoading() {
    return (
        <div className="grid gap-0.5 p-2" aria-busy="true" aria-label={t('common.loading')}>
            {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className={cx('grid items-center gap-4 px-4 py-3', COLUMNS)}>
                    <Skeleton w={40} h={40} r={999} />
                    <span className="grid gap-1.5">
                        <Skeleton w={`${50 + ((i * 13) % 30)}%`} h={14} />
                        <Skeleton w={56} h={11} />
                    </span>
                    <span className="hidden gap-1.5 md:grid">
                        <Skeleton w="60%" h={12} />
                        <Skeleton w="40%" h={11} />
                    </span>
                    <span className="hidden gap-1.5 md:grid">
                        <Skeleton w="70%" h={12} />
                        <Skeleton w="45%" h={11} />
                    </span>
                    <Skeleton w={80} h={14} className="justify-self-end" />
                </div>
            ))}
        </div>
    );
}
