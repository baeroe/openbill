import { useEffect, useState } from 'react';
import type { FieldDefinition } from '@/api/types';
import { CustomFieldInput } from '@/components/custom-field-input';
import { Button, Drawer, Select, Switch, TextInput } from '@/components/ui';
import type { ContactDraft } from '@/lib/customers';
import { t } from '@/lib/i18n';

type Props = {
    contact: ContactDraft | null;
    isNew: boolean;
    fields: FieldDefinition[];
    /** API errors of this contact, keyed by field ("email", "custom.department"). */
    errors: Record<string, string>;
    onClose(): void;
    onApply(contact: ContactDraft): void;
};

/** Edits a contact. The change lands in the customer draft and is saved together with the customer. */
export function ContactDrawer({ contact, isNew, fields, errors, onClose, onApply }: Props) {
    const [draft, setDraft] = useState<ContactDraft | null>(contact);
    const [touched, setTouched] = useState(false);
    useEffect(() => {
        setDraft(contact);
        setTouched(false);
    }, [contact]);

    if (!draft) return null;

    const set = (patch: Partial<ContactDraft>) => setDraft({ ...draft, ...patch });
    const nameMissing = !draft.first_name.trim() && !draft.last_name.trim();
    const salutations = ['', t('contact.salutation_ms'), t('contact.salutation_mr'), t('contact.salutation_mx')];
    const options = salutations.includes(draft.salutation) ? salutations : [...salutations, draft.salutation];

    return (
        <Drawer
            open
            onClose={onClose}
            title={isNew ? t('contact.add_title') : t('contact.edit_title')}
            description={t('contact.drawer_text')}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => {
                            setTouched(true);
                            if (!nameMissing) onApply(draft);
                        }}
                    >
                        {isNew ? t('contact.add') : t('contact.apply')}
                    </Button>
                </>
            }
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <Select label={t('contact.salutation')} value={draft.salutation} error={errors.salutation} onChange={(e) => set({ salutation: e.target.value })}>
                    {options.map((salutation) => (
                        <option key={salutation} value={salutation}>
                            {salutation || t('contact.salutation_none')}
                        </option>
                    ))}
                </Select>
                <TextInput label={t('contact.position')} value={draft.position} placeholder={t('contact.position_placeholder')} error={errors.position} onChange={(e) => set({ position: e.target.value })} />
                <TextInput
                    label={t('contact.first_name')}
                    value={draft.first_name}
                    error={touched && nameMissing ? t('contact.name_required') : errors.first_name}
                    onChange={(e) => set({ first_name: e.target.value })}
                />
                <TextInput label={t('contact.last_name')} value={draft.last_name} error={errors.last_name} onChange={(e) => set({ last_name: e.target.value })} />
                <TextInput label={t('contact.email')} type="email" wrapClassName="sm:col-span-2" value={draft.email} error={errors.email} onChange={(e) => set({ email: e.target.value })} />
                <TextInput label={t('contact.phone')} type="tel" wrapClassName="sm:col-span-2" value={draft.phone} error={errors.phone} onChange={(e) => set({ phone: e.target.value })} />
            </div>
            <Switch label={t('contact.is_default')} checked={draft.is_default} onChange={(e) => set({ is_default: e.target.checked })} />
            {fields.length > 0 && (
                <div className="grid gap-4">
                    <h3 className="text-md">{t('contact.fields')}</h3>
                    {fields.map((field) => (
                        <CustomFieldInput
                            key={field.id}
                            definition={field}
                            value={draft.custom[field.key]}
                            error={errors[`custom.${field.key}`]}
                            onChange={(value) => set({ custom: { ...draft.custom, [field.key]: value } })}
                        />
                    ))}
                </div>
            )}
        </Drawer>
    );
}
