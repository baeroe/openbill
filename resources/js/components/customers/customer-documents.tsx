import { Link } from '@inertiajs/react';
import { FilePlus, FileText } from 'lucide-react';
import { useDocumentList } from '@/api/documents';
import { useNewDocument } from '@/components/new-document/new-document-context';
import { Button, Card, CardHead, EmptyState, ErrorState, Skeleton, StatusBadge } from '@/components/ui';
import { formatDate, formatMoney } from '@/lib/format';
import { path, t, tn } from '@/lib/i18n';

const SHOWN = 10;

/** Documents of a customer, newest first; "New" is off while the customer has unsaved changes. */
export function CustomerDocuments({ customerId, disabled = false }: { customerId: string; disabled?: boolean }) {
    const list = useDocumentList({ customer_id: customerId });
    const openNewDocument = useNewDocument();
    const create = (label: string, variant: 'soft' | 'primary') => (
        <Button size="sm" variant={variant} icon={<FilePlus />} disabled={disabled} title={disabled ? t('customer.save_first') : undefined} onClick={() => openNewDocument({ customerId })}>
            {label}
        </Button>
    );

    return (
        <Card aria-labelledby="customer-documents">
            <CardHead titleId="customer-documents" title={t('customer.documents')} description={list.total > 0 ? tn('documents.count', list.total) : undefined} actions={create(t('customer.documents_new'), 'soft')} />
            {list.error ? (
                <ErrorState error={list.error} onRetry={list.retry} />
            ) : list.isLoading ? (
                <div className="grid gap-2" aria-busy="true" aria-label={t('common.loading')}>
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="flex justify-between gap-4 p-3">
                            <Skeleton w="55%" h={13} />
                            <Skeleton w={70} h={13} />
                        </div>
                    ))}
                </div>
            ) : list.items.length === 0 ? (
                <EmptyState compact icon={<FileText />} title={t('customer.documents_empty')} actions={create(t('customer.documents_create'), 'primary')} />
            ) : (
                <div className="-mx-3 grid gap-0.5">
                    {list.items.slice(0, SHOWN).map((document) => (
                        <Link
                            key={document.id}
                            href={path(`/documents/${document.id}`)}
                            className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 rounded-md p-3 text-inherit no-underline transition-colors hover:bg-surface-2"
                        >
                            <span className="truncate font-semibold">
                                {t(`document_type.${document.type}`)} {document.number ?? t('overview.draft_label')}
                            </span>
                            <span className="num text-right font-semibold">{formatMoney(document.gross_total)}</span>
                            <span className="num truncate text-sm text-muted">{formatDate(document.date)}</span>
                            <span className="justify-self-end">
                                <StatusBadge status={document.status} overdue={document.is_overdue} />
                            </span>
                        </Link>
                    ))}
                    {list.total > SHOWN && (
                        <Link href={path(`/documents?customer_id=${customerId}`)} className="px-3 pt-2 text-sm font-strong text-accent no-underline hover:underline">
                            {t('overview.all_documents')}
                        </Link>
                    )}
                </div>
            )}
        </Card>
    );
}
