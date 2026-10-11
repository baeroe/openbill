import { router } from '@inertiajs/react';
import { FileCheck2, FilePlus2, FileText, FileX2, type LucideIcon } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { useCustomer, useCustomerOptions } from '@/api/customers';
import { createDocument } from '@/api/documents';
import type { Customer, DocumentType } from '@/api/types';
import { Button, cx, Dialog, SearchInput, Skeleton } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { path, t } from '@/lib/i18n';
import { toast } from '@/lib/toast';

export type NewDocumentOptions = { type?: DocumentType; customerId?: string };

const TYPES: { type: DocumentType; icon: LucideIcon }[] = [
    { type: 'offer', icon: FilePlus2 },
    { type: 'confirmation', icon: FileCheck2 },
    { type: 'invoice', icon: FileText },
    { type: 'cancellation', icon: FileX2 },
];

/** Cancellations come from an invoice (CreateDocument refuses them), so the card is only an explanation. */
const creatable = (type: DocumentType) => type !== 'cancellation';

/** Mounted fresh for every opening (key in NewDocumentProvider), so the start values come from `options` before the first focus. */
export function NewDocumentDialog({ open, options, onClose }: { open: boolean; options: NewDocumentOptions; onClose(): void }) {
    const [type, setType] = useState<DocumentType>(options.type && creatable(options.type) ? options.type : 'offer');
    const [customerId, setCustomerId] = useState(options.customerId ?? '');
    const [query, setQuery] = useState('');
    const [pending, setPending] = useState(false);
    const search = useDebounced(query, 250);
    const customers = useCustomerOptions(search, open);
    const selected = useCustomer(open && customerId ? customerId : null);

    // a preselected customer stays visible even when it is not among the first matches
    const results = customers.data?.items ?? [];
    const list: Customer[] = selected.data && !results.some((c) => c.id === selected.data?.id) ? [selected.data, ...results] : results;

    const moveType = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
        event.preventDefault();
        const enabled = TYPES.filter((item) => creatable(item.type));
        const index = enabled.findIndex((item) => item.type === type);
        const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : enabled.length - 1;
        const next = enabled[(index + step) % enabled.length];
        setType(next.type);
        event.currentTarget.querySelector<HTMLElement>(`[data-type="${next.type}"]`)?.focus();
    };

    // customers as a radio group: one tab stop, arrow keys move and select (the search field hands over with ArrowDown)
    const choices = ['', ...list.map((customer) => customer.id)];
    const focusChoice = (container: HTMLElement | null, id: string) => container?.querySelector<HTMLElement>(`[data-customer="${id}"]`)?.focus();
    const moveCustomer = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const index = Math.max(0, choices.indexOf(customerId));
        const next =
            event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? choices.length - 1
                  : (index + (event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : choices.length - 1)) % choices.length;
        setCustomerId(choices[next]);
        focusChoice(event.currentTarget, choices[next]);
    };

    const submit = async () => {
        setPending(true);
        try {
            const document = await createDocument({ type, customer_id: customerId || null });
            toast.success(t('new_document.created', { type: t(`document_type.${type}`) }));
            onClose();
            router.visit(path(`/documents/${document.id}`));
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setPending(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            wide
            title={t('new_document.title')}
            description={t('new_document.description')}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" pending={pending} onClick={() => void submit()}>
                        {t('new_document.create', { type: t(`document_type.${type}`) })}
                    </Button>
                </>
            }
        >
            <div role="radiogroup" aria-label={t('new_document.type_label')} onKeyDown={moveType} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TYPES.map(({ type: value, icon: Icon }) => (
                    <button
                        key={value}
                        type="button"
                        role="radio"
                        data-type={value}
                        aria-checked={type === value}
                        disabled={!creatable(value)}
                        title={creatable(value) ? undefined : t('new_document.cancellation_hint')}
                        tabIndex={type === value ? 0 : -1}
                        data-autofocus={type === value ? '' : undefined}
                        onClick={() => setType(value)}
                        className="group grid content-start justify-items-start gap-1 rounded-lg bg-surface-2 p-4 text-left text-ink transition-[background-color,box-shadow] hover:enabled:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-55 aria-checked:bg-accent-soft aria-checked:shadow-[inset_0_0_0_2px_var(--accent)] aria-checked:hover:bg-accent-soft"
                    >
                        <span className="mb-2 grid size-9 place-items-center rounded-md bg-surface text-muted group-aria-checked:bg-accent group-aria-checked:text-accent-ink [&_svg]:size-[1.1rem]">
                            <Icon aria-hidden />
                        </span>
                        <span className="font-heading">{t(`document_type.${value}`)}</span>
                        <span className="text-xs leading-snug text-muted">{t(`new_document.${value}_text`)}</span>
                    </button>
                ))}
            </div>

            <div className="grid gap-1.5">
                <span id="new-document-customer" className="text-sm font-medium text-muted">
                    {t('new_document.customer')}
                </span>
                <SearchInput
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key !== 'ArrowDown') return;
                        e.preventDefault();
                        focusChoice(document.getElementById('new-document-customers'), customerId);
                    }}
                    placeholder={t('new_document.search')}
                    aria-label={t('new_document.search')}
                    aria-controls="new-document-customers"
                />
                <div
                    id="new-document-customers"
                    role="radiogroup"
                    aria-labelledby="new-document-customer"
                    onKeyDown={moveCustomer}
                    className="grid max-h-60 grid-cols-[minmax(0,1fr)] gap-0.5 overflow-auto p-0.5"
                >
                    {customers.error ? (
                        <p className="p-3 text-sm text-muted">
                            {t('new_document.load_failed')}{' '}
                            <button type="button" className="font-strong text-accent" onClick={() => void customers.mutate()}>
                                {t('common.retry')}
                            </button>
                        </p>
                    ) : customers.isLoading ? (
                        Array.from({ length: 3 }, (_, i) => <Skeleton key={i} h={40} r={12} />)
                    ) : (
                        <>
                            <CustomerOption id="" selected={customerId === ''} onSelect={() => setCustomerId('')} name={t('new_document.later')} />
                            {list.map((customer) => (
                                <CustomerOption
                                    key={customer.id}
                                    id={customer.id}
                                    selected={customerId === customer.id}
                                    onSelect={() => setCustomerId(customer.id)}
                                    name={customer.name}
                                    meta={[customer.number, customer.city].filter(Boolean).join(' · ')}
                                />
                            ))}
                            {list.length === 0 && search.trim() !== '' && <p className="p-3 text-sm text-muted">{t('new_document.no_match', { q: search.trim() })}</p>}
                        </>
                    )}
                </div>
            </div>
        </Dialog>
    );
}

function CustomerOption({ id, selected, onSelect, name, meta }: { id: string; selected: boolean; onSelect(): void; name: string; meta?: string }) {
    return (
        <button
            type="button"
            role="radio"
            data-customer={id}
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={onSelect}
            className={cx('flex w-full min-w-0 items-baseline gap-3 rounded-md px-3 py-[9px] text-left text-ink transition-colors hover:bg-surface-2 aria-checked:bg-accent-soft aria-checked:text-accent')}
        >
            <span className="min-w-0 truncate font-strong">{name}</span>
            {meta && <span className="ml-auto min-w-0 shrink-[2] truncate text-xs text-muted">{meta}</span>}
        </button>
    );
}
