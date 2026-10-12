import { Head, router } from '@inertiajs/react';
import { AlertTriangle, FilePlus, MoreHorizontal, Pencil, Plus, Star, Trash2, UserRound } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { deleteCustomer, saveCustomer, useCustomer } from '@/api/customers';
import { useFieldDefinitions } from '@/api/fields';
import type { CustomerKind, SupplyType, TaxTreatment } from '@/api/types';
import { ContactDrawer } from '@/components/customers/contact-drawer';
import { CustomerDocuments } from '@/components/customers/customer-documents';
import { CustomFieldInput } from '@/components/custom-field-input';
import { useNewDocument } from '@/components/new-document/new-document-context';
import { Avatar, BackLink, Badge, Button, Card, CardHead, ConfirmDialog, ErrorState, Menu, MenuItem, MenuSeparator, Notice, Page, Select, Skeleton, Tag, TextInput } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { ApiError, errorMessage } from '@/lib/api';
import {
    applyContact,
    contactErrors,
    contactName,
    COUNTRIES,
    draftOf,
    emptyCustomer,
    inputOf,
    makeDefault,
    newContact,
    removeContact,
    TAX_TREATMENTS,
    type ContactDraft,
    type CustomerDraft,
} from '@/lib/customers';
import { countryName } from '@/lib/format';
import { useLeaveGuard } from '@/lib/hooks';
import { path, t } from '@/lib/i18n';
import { toast } from '@/lib/toast';

export default function CustomerPage({ customer_id: id }: { customer_id: string | null }) {
    // a fresh editor per customer, so a draft never wanders to another customer
    return id === null ? <CustomerEditor key="new" id={null} initial={emptyCustomer()} /> : <ExistingCustomer key={id} id={id} />;
}

CustomerPage.layout = appLayout;

function ExistingCustomer({ id }: { id: string }) {
    const { data, error, mutate } = useCustomer(id);

    // only when nothing is loaded: a failed background reload (focus, reconnect) must not replace the form and
    // throw away unsaved changes
    if (error && !data) {
        return (
            <Page>
                <BackLink href={path('/customers')}>{t('customer.all')}</BackLink>
                <ErrorState error={error} title={t('customer.load_failed')} onRetry={() => void mutate()} />
            </Page>
        );
    }
    if (!data) return <DetailSkeleton />;
    return <CustomerEditor id={id} initial={draftOf(data)} />;
}

/** Focus the first field marked invalid (after React rendered the errors). */
const focusFirstInvalid = () => requestAnimationFrame(() => document.querySelector<HTMLElement>('main [aria-invalid="true"]')?.focus());

function CustomerEditor({ id, initial }: { id: string | null; initial: CustomerDraft }) {
    const isNew = id === null;
    const customerFields = useFieldDefinitions('customer');
    const contactFields = useFieldDefinitions('contact');
    const openNewDocument = useNewDocument();
    const [base, setBase] = useState(initial);
    const [draft, setDraft] = useState(initial);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [triedSave, setTriedSave] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState<{ contact: ContactDraft; isNew: boolean } | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(base), [draft, base]);
    const release = useLeaveGuard(dirty, t('customer.leave_confirm'));

    const set = (patch: Partial<CustomerDraft>) => setDraft((current) => ({ ...current, ...patch }));
    const nameError = errors.name ?? (triedSave && !draft.name.trim() ? t('customer.name_required') : undefined);
    const vatMissing = draft.tax_treatment === 'eu_reverse_charge' && !draft.vat_id.trim();
    const title = draft.name.trim() || (isNew ? t('customer.new_title') : t('customer.no_name'));
    const editingIndex = editing ? draft.contacts.findIndex((contact) => contact.key === editing.contact.key) : -1;

    const submit = async (event?: FormEvent) => {
        event?.preventDefault();
        setTriedSave(true);
        if (!draft.name.trim()) {
            focusFirstInvalid();
            return;
        }
        setSaving(true);
        try {
            const saved = await saveCustomer(inputOf(draft), id ?? undefined);
            const next = draftOf(saved);
            setBase(next);
            setDraft(next);
            setErrors({});
            setTriedSave(false);
            toast.success(isNew ? t('customer.created') : t('customer.saved'));
            if (isNew) {
                release();
                router.visit(path(`/customers/${saved.id}`), { replace: true });
            }
        } catch (error) {
            if (error instanceof ApiError && error.status === 422) {
                setErrors(error.fieldErrors());
                toast.error(t('customer.invalid'));
                focusFirstInvalid();
            } else {
                toast.error(errorMessage(error));
            }
        } finally {
            setSaving(false);
        }
    };

    const discard = () => {
        if (isNew) {
            release();
            router.visit(path('/customers'));
            return;
        }
        setDraft(base);
        setErrors({});
        setTriedSave(false);
    };

    const remove = async () => {
        if (id === null) return;
        setDeleting(true);
        try {
            await deleteCustomer(id);
            toast.success(t('customer.deleted'));
            release();
            router.visit(path('/customers'));
        } catch (error) {
            setConfirmDelete(false);
            toast.error(errorMessage(error));
        } finally {
            setDeleting(false);
        }
    };

    const applyEdited = (contact: ContactDraft) => {
        set({ contacts: applyContact(draft.contacts, contact) });
        // what the API complained about for this contact was just edited
        if (editingIndex >= 0) setErrors((current) => Object.fromEntries(Object.entries(current).filter(([path]) => !path.startsWith(`contacts.${editingIndex}.`))));
        setEditing(null);
    };

    return (
        <Page>
            <Head title={title} />
            <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-6">
                <header className="flex flex-wrap items-end gap-4">
                    <div className="grid min-w-0 gap-1">
                        <BackLink href={path('/customers')}>{t('customer.all')}</BackLink>
                        <div className="flex min-w-0 items-center gap-4">
                            <Avatar name={draft.name} size="lg" tone="accent">
                                {isNew && !draft.name.trim() ? <UserRound /> : undefined}
                            </Avatar>
                            <div className="grid min-w-0 gap-1">
                                <h1 className="text-2xl font-bold tracking-title [overflow-wrap:anywhere] sm:text-3xl">{title}</h1>
                                <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                                    {draft.number && <span className="num">{draft.number}</span>}
                                    {draft.city && (
                                        <span>
                                            {draft.city}, {countryName(draft.country)}
                                        </span>
                                    )}
                                    {isNew && <Badge plain>{t('customer.not_saved')}</Badge>}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="ml-auto flex flex-wrap items-center gap-3">
                        {!isNew && (
                            <Button variant="soft" icon={<FilePlus />} disabled={dirty} title={dirty ? t('customer.save_first') : undefined} onClick={() => openNewDocument({ customerId: id ?? undefined })}>
                                {t('customer.new_document')}
                            </Button>
                        )}
                        <Button type="submit" variant="primary" pending={saving} disabled={!dirty && !isNew}>
                            {isNew ? t('customer.create') : t('customer.save')}
                        </Button>
                        {!isNew && (
                            <Menu
                                trigger={
                                    <Button iconOnly icon={<MoreHorizontal />}>
                                        {t('customer.more')}
                                    </Button>
                                }
                            >
                                <MenuItem danger icon={<Trash2 />} onSelect={() => setConfirmDelete(true)}>
                                    {t('customer.delete')}
                                </MenuItem>
                            </Menu>
                        )}
                    </div>
                </header>

                <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                    <div className="grid content-start gap-6">
                        <Card aria-labelledby="customer-base">
                            <CardHead titleId="customer-base" title={t('customer.base')} />
                            <div className="grid gap-4 sm:grid-cols-2">
                                <TextInput
                                    label={t('customer.name')}
                                    path="name"
                                    wrapClassName="sm:col-span-2"
                                    value={draft.name}
                                    placeholder={t('customer.name_placeholder')}
                                    error={nameError}
                                    autoFocus={isNew}
                                    onChange={(e) => set({ name: e.target.value })}
                                />
                                <TextInput
                                    label={t('customer.number')}
                                    path="number"
                                    className="num"
                                    value={draft.number}
                                    hint={isNew ? t('customer.number_hint') : undefined}
                                    error={errors.number}
                                    onChange={(e) => set({ number: e.target.value })}
                                />
                                <TextInput label={t('customer.email')} type="email" path="email" value={draft.email} error={errors.email} onChange={(e) => set({ email: e.target.value })} />
                                <TextInput label={t('customer.street')} path="street" wrapClassName="sm:col-span-2" value={draft.street} error={errors.street} onChange={(e) => set({ street: e.target.value })} />
                                <TextInput label={t('customer.zip')} path="zip" value={draft.zip} error={errors.zip} onChange={(e) => set({ zip: e.target.value })} />
                                <TextInput label={t('customer.city')} path="city" value={draft.city} error={errors.city} onChange={(e) => set({ city: e.target.value })} />
                                <Select label={t('customer.country')} path="country" value={draft.country} error={errors.country} onChange={(e) => set({ country: e.target.value })}>
                                    {[...new Set([draft.country, ...COUNTRIES])].filter(Boolean).map((code) => (
                                        <option key={code} value={code}>
                                            {countryName(code)}
                                        </option>
                                    ))}
                                </Select>
                                <TextInput
                                    label={t('customer.vat_id')}
                                    path="vat_id"
                                    value={draft.vat_id}
                                    placeholder={t('customer.vat_id_placeholder')}
                                    error={errors.vat_id ?? (vatMissing && triedSave ? t('customer.vat_id_required') : undefined)}
                                    onChange={(e) => set({ vat_id: e.target.value })}
                                />
                            </div>
                        </Card>

                        <Card aria-labelledby="customer-tax">
                            <CardHead titleId="customer-tax" title={t('customer.tax')} description={t('customer.tax_text')} />
                            <div role="radiogroup" aria-labelledby="customer-tax" className="grid gap-2 sm:grid-cols-3">
                                {TAX_TREATMENTS.map((value) => (
                                    <TaxOption key={value} value={value} checked={draft.tax_treatment === value} onChange={() => set({ tax_treatment: value })} />
                                ))}
                            </div>
                            <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
                                <Select
                                    label={t('customer.kind')}
                                    hint={t('customer.kind_hint')}
                                    path="customer_kind"
                                    value={draft.customer_kind}
                                    error={errors.customer_kind}
                                    onChange={(e) => set({ customer_kind: e.target.value as CustomerKind })}
                                >
                                    <option value="business">{t('customer.kind.business')}</option>
                                    <option value="consumer">{t('customer.kind.consumer')}</option>
                                </Select>
                                {draft.tax_treatment === 'third_country' && (
                                    <Select
                                        label={t('customer.supply_type')}
                                        hint={t('customer.supply_type_hint')}
                                        path="supply_type"
                                        value={draft.supply_type}
                                        error={errors.supply_type}
                                        onChange={(e) => set({ supply_type: e.target.value as SupplyType })}
                                    >
                                        <option value="services">{t('customer.supply_type.services')}</option>
                                        <option value="goods">{t('customer.supply_type.goods')}</option>
                                    </Select>
                                )}
                            </div>
                            {vatMissing && (
                                <Notice tone="warn" icon={<AlertTriangle />} className="mt-4">
                                    <b>{t('customer.vat_missing')}</b> {t('customer.vat_missing_text')}
                                </Notice>
                            )}
                        </Card>

                        <Card aria-labelledby="customer-fields">
                            <CardHead
                                titleId="customer-fields"
                                title={t('customer.fields')}
                                description={
                                    <>
                                        {t('customer.fields_text')} <code className="rounded-[6px] bg-surface-2 px-1.5 py-px font-mono text-[0.8em] text-ink">{'{{ customer.key }}'}</code>
                                    </>
                                }
                            />
                            {customerFields.error ? (
                                <ErrorState error={customerFields.error} onRetry={() => void customerFields.mutate()} />
                            ) : !customerFields.data ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Skeleton h={60} />
                                    <Skeleton h={60} />
                                </div>
                            ) : customerFields.data.length === 0 ? (
                                <p className="text-muted">{t('customer.fields_empty')}</p>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {customerFields.data.map((field) => (
                                        <CustomFieldInput
                                            key={field.id}
                                            definition={field}
                                            path={`custom.${field.key}`}
                                            value={draft.custom[field.key]}
                                            error={errors[`custom.${field.key}`]}
                                            onChange={(value) => set({ custom: { ...draft.custom, [field.key]: value } })}
                                        />
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>

                    <div className="grid content-start gap-6">
                        <Card aria-labelledby="customer-contacts">
                            <CardHead
                                titleId="customer-contacts"
                                title={t('customer.contacts')}
                                description={t('customer.contacts_text')}
                                actions={
                                    <Button size="sm" variant="soft" icon={<Plus />} onClick={() => setEditing({ contact: newContact(draft.contacts), isNew: true })}>
                                        {t('customer.contacts_add')}
                                    </Button>
                                }
                            />
                            {draft.contacts.length === 0 ? (
                                <p className="text-muted">{t('customer.contacts_empty')}</p>
                            ) : (
                                <div className="-mx-3 grid gap-0.5">
                                    {draft.contacts.map((contact, index) => (
                                        <ContactRow
                                            key={contact.key}
                                            contact={contact}
                                            invalid={Object.keys(contactErrors(errors, index)).length > 0}
                                            onEdit={() => setEditing({ contact, isNew: false })}
                                            onDefault={() => set({ contacts: makeDefault(draft.contacts, contact.key) })}
                                            onRemove={() => set({ contacts: removeContact(draft.contacts, contact.key) })}
                                        />
                                    ))}
                                </div>
                            )}
                        </Card>
                        {id !== null && <CustomerDocuments customerId={id} disabled={dirty} />}
                    </div>
                </div>

                {dirty && (
                    <div role="region" data-savebar aria-label={t('customer.unsaved')} className="sticky bottom-4 z-20 mx-auto flex w-full max-w-xl animate-pop-in items-center gap-3 rounded-full bg-ink py-2 pr-2 pl-5 text-bg shadow-float">
                        <span className="flex-1 text-sm font-medium">{isNew ? t('customer.unsaved_new') : t('customer.unsaved')}</span>
                        {/* own classes: a ghost <Button> would bring its own text color */}
                        <button type="button" onClick={discard} className="h-control-sm rounded-full px-3 text-sm font-strong text-bg opacity-80 transition-[background-color,opacity] hover:bg-white/10 hover:opacity-100 dark:hover:bg-black/10">
                            {isNew ? t('customer.discard') : t('customer.reset')}
                        </button>
                        <Button type="submit" size="sm" variant="primary" pending={saving}>
                            {isNew ? t('customer.create') : t('customer.save')}
                        </Button>
                    </div>
                )}
            </form>

            {editing && (
                <ContactDrawer
                    key={editing.contact.key}
                    contact={editing.contact}
                    isNew={editing.isNew}
                    fields={contactFields.data ?? []}
                    errors={editingIndex >= 0 ? contactErrors(errors, editingIndex) : {}}
                    onClose={() => setEditing(null)}
                    onApply={applyEdited}
                />
            )}
            {!isNew && (
                <ConfirmDialog
                    open={confirmDelete}
                    onClose={() => setConfirmDelete(false)}
                    onConfirm={() => void remove()}
                    title={t('customer.delete_title', { name: base.name })}
                    description={t('customer.delete_text')}
                    confirmLabel={t('customer.delete_confirm')}
                    icon={<Trash2 />}
                    pending={deleting}
                    danger
                />
            )}
        </Page>
    );
}

function TaxOption({ value, checked, onChange }: { value: TaxTreatment; checked: boolean; onChange(): void }) {
    return (
        <label className="relative grid cursor-pointer content-start gap-1 rounded-md bg-surface-2 p-4 transition-[background-color,box-shadow] hover:bg-surface-3 has-checked:bg-accent-soft has-checked:shadow-[inset_0_0_0_2px_var(--accent)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent">
            <input type="radio" name="tax_treatment" value={value} checked={checked} onChange={onChange} className="peer pointer-events-none absolute opacity-0" />
            <strong className="font-semibold peer-checked:text-accent">{t(`tax_treatment.${value}`)}</strong>
            <span className="text-sm leading-snug text-muted">{t(`tax_treatment.${value}_text`)}</span>
        </label>
    );
}

function ContactRow({ contact, invalid, onEdit, onDefault, onRemove }: { contact: ContactDraft; invalid: boolean; onEdit(): void; onDefault(): void; onRemove(): void }) {
    const name = contactName(contact) || t('contact.no_name');

    return (
        <div className="flex items-center gap-3 rounded-md p-3 transition-colors hover:bg-surface-2">
            <Avatar name={`${contact.first_name} ${contact.last_name}`} size="sm" />
            <div className="grid min-w-0 flex-1 gap-0.5">
                <div className="flex min-w-0 items-center gap-2 font-semibold">
                    <button type="button" onClick={onEdit} className="truncate text-left hover:underline">
                        {name}
                    </button>
                    {contact.is_default && <Tag>{t('customer.contact_default')}</Tag>}
                    {invalid && <Tag tone="bad">{t('customer.contact_invalid')}</Tag>}
                </div>
                <div className="truncate text-sm text-muted">{[contact.position, contact.email].filter(Boolean).join(' · ') || t('customer.contact_no_details')}</div>
            </div>
            <Menu
                trigger={
                    <Button size="sm" variant="ghost" iconOnly icon={<MoreHorizontal />}>
                        {t('customer.contact_actions', { name })}
                    </Button>
                }
            >
                <MenuItem icon={<Pencil />} onSelect={onEdit}>
                    {t('customer.contact_edit')}
                </MenuItem>
                <MenuItem icon={<Star />} disabled={contact.is_default} onSelect={onDefault}>
                    {t('customer.contact_make_default')}
                </MenuItem>
                <MenuSeparator />
                <MenuItem danger icon={<Trash2 />} onSelect={onRemove}>
                    {t('customer.contact_remove')}
                </MenuItem>
            </Menu>
        </div>
    );
}

function DetailSkeleton() {
    return (
        <Page>
            <div className="grid gap-2" aria-busy="true" aria-label={t('common.loading')}>
                <Skeleton w={90} h={12} />
                <div className="flex items-center gap-4">
                    <Skeleton w={52} h={52} r={999} />
                    <div className="grid flex-1 gap-2">
                        <Skeleton w="40%" h={30} />
                        <Skeleton w={120} h={12} />
                    </div>
                </div>
            </div>
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                <div className="grid gap-6">
                    <Card className="grid gap-4">
                        <Skeleton w={110} h={18} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            {Array.from({ length: 6 }, (_, i) => (
                                <Skeleton key={i} h={58} />
                            ))}
                        </div>
                    </Card>
                    <Card className="grid gap-4">
                        <Skeleton w={150} h={18} />
                        <Skeleton h={90} />
                    </Card>
                </div>
                <Card className="grid gap-4">
                    {Array.from({ length: 3 }, (_, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <Skeleton w={32} h={32} r={999} />
                            <Skeleton w="60%" h={14} />
                        </div>
                    ))}
                </Card>
            </div>
        </Page>
    );
}
