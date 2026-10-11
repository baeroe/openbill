import { Link } from '@inertiajs/react';
import { useCustomer } from '@/api/customers';
import { useFieldDefinitions } from '@/api/fields';
import { useCustomerChoices } from '@/api/master-data';
import type { DocumentPageContext } from '@/api/types';
import { CustomFieldInput } from '@/components/custom-field-input';
import { Select, TextInput } from '@/components/ui';
import { path, t } from '@/lib/i18n';
import type { Draft } from '../types';

type DateKey = 'date' | 'valid_until' | 'service_date' | 'service_date_end' | 'due_date';

type Props = {
    draft: Draft;
    context: DocumentPageContext;
    readOnly: boolean;
    /** data-path → message (field errors of the last save and compliance issues). */
    messages: Record<string, string>;
    customerName: string | null;
    update(fn: (draft: Draft) => Draft): void;
};

/** Customer, contact, dates, language, template and the document's custom fields. */
export function HeaderFields({ draft, context, readOnly, messages, customerName, update }: Props) {
    const choices = useCustomerChoices();
    const customer = useCustomer(draft.customer_id);
    const fields = useFieldDefinitions('document');
    const set = (patch: Partial<Draft>) => update((d) => ({ ...d, ...patch }));

    const list = choices.data?.items ?? [];
    const current = customer.data;
    const options = current && !list.some((c) => c.id === current.id) ? [...list, current] : list;
    const contacts = current?.contacts ?? [];
    const definitions = (fields.data ?? []).filter((definition) => definition.doc_types.includes(draft.type));
    const templates = context.templates.filter((template) => template.document_types.includes(draft.type) || template.id === draft.template_id);

    const date = (key: DateKey, label: string, hint?: string) => (
        <TextInput
            label={label}
            type="date"
            value={draft[key] ?? ''}
            disabled={readOnly}
            path={`document.${key}`}
            error={messages[`document.${key}`]}
            hint={hint}
            // the document date is required: clearing it keeps the old one
            onChange={(e) => set({ [key]: e.target.value || (key === 'date' ? draft.date : null) } as Partial<Draft>)}
        />
    );

    return (
        <div className="grid gap-4">
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(12.5rem,1fr))]">
                <Select
                    label={t('editor.customer')}
                    value={draft.customer_id ?? ''}
                    disabled={readOnly || draft.type === 'cancellation'}
                    path="document.customer"
                    wrapClassName="xs:col-span-2"
                    error={messages['document.customer']}
                    hint={draft.type === 'cancellation' && !readOnly ? t('errors.cancellation_customer') : undefined}
                    aside={
                        draft.customer_id && (
                            <Link href={path(`/customers/${draft.customer_id}`)} className="text-xs font-medium text-accent no-underline hover:underline">
                                {t('editor.customer_open')}
                            </Link>
                        )
                    }
                    onChange={(e) => {
                        const chosen = options.find((c) => c.id === e.target.value);
                        // PATCH always sends contact_id, so the default contact is chosen here (UpdateDraft only picks it when contact_id is missing)
                        set({ customer_id: chosen?.id ?? null, contact_id: chosen?.contacts.find((c) => c.is_default)?.id ?? null });
                    }}
                >
                    <option value="">{t('editor.customer_choose')}</option>
                    {options.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                    {draft.customer_id && !options.some((c) => c.id === draft.customer_id) && <option value={draft.customer_id}>{customerName ?? '…'}</option>}
                </Select>
                <Select
                    label={t('editor.contact')}
                    value={draft.contact_id ?? ''}
                    disabled={readOnly || contacts.length === 0}
                    path="document.contact"
                    error={messages['document.contact']}
                    onChange={(e) => set({ contact_id: e.target.value || null })}
                >
                    <option value="">{contacts.length ? t('editor.contact_none') : t('editor.contact_empty')}</option>
                    {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                            {`${c.first_name} ${c.last_name}`.trim()}
                        </option>
                    ))}
                </Select>
                {date('date', t('editor.date'))}
                {draft.type === 'offer' && date('valid_until', t('editor.valid_until'))}
                {(draft.type === 'invoice' || draft.type === 'cancellation') && (
                    <>
                        {date('service_date', t('editor.service_date'))}
                        {date('service_date_end', t('editor.service_date_end'), t('editor.service_date_end_hint'))}
                    </>
                )}
                {draft.type === 'invoice' && date('due_date', t('editor.due_date'))}
                <Select label={t('editor.locale')} value={draft.locale} disabled={readOnly} path="document.locale" onChange={(e) => set({ locale: e.target.value })}>
                    <option value="en">{t('locale.en')}</option>
                    <option value="de">{t('locale.de')}</option>
                </Select>
                <Select
                    label={t('editor.template')}
                    value={draft.template_id ?? ''}
                    disabled={readOnly}
                    path="document.template"
                    error={messages['document.template']}
                    onChange={(e) => set({ template_id: e.target.value || null })}
                >
                    {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                            {template.name}
                        </option>
                    ))}
                </Select>
            </div>

            {definitions.length > 0 && (
                <div className="grid gap-3 rounded-lg bg-bg p-4">
                    <span className="text-sm font-strong">{t('editor.custom_fields')}</span>
                    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(12.5rem,1fr))]">
                        {definitions.map((definition) => (
                            <CustomFieldInput
                                key={definition.id}
                                definition={definition}
                                value={draft.custom[definition.key]}
                                disabled={readOnly}
                                path={`document.custom.${definition.key}`}
                                error={messages[`document.custom.${definition.key}`]}
                                onChange={(value) => update((d) => ({ ...d, custom: { ...d.custom, [definition.key]: value } }))}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
