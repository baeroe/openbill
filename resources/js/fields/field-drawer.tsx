import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { saveFieldDefinition, type FieldDefinitionInput } from '@/api/fields';
import { DOCUMENT_TYPES, type CustomValue, type FieldDefinition, type FieldType } from '@/api/types';
import { CustomFieldInput } from '@/components/custom-field-input';
import { Button, Checkbox, Drawer, Field, Switch, Textarea, TextInput, controlClass, cx } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { liquidPath } from './expression';
import { hasDocTypes, slugKey } from './field-form';

const TYPES: FieldType[] = ['text', 'textarea', 'number', 'money', 'date', 'select', 'boolean', 'image'];

type Props = { initial: FieldDefinitionInput; id?: string; onClose(): void };

/** Create or edit a custom field; the preview shows the input as forms will show it. */
export function FieldDrawer({ initial, id, onClose }: Props) {
    const isNew = !id;
    const [draft, setDraft] = useState<FieldDefinitionInput>(() => (isNew && initial.label && !initial.key ? { ...initial, key: slugKey(initial.label) } : initial));
    const [keyTouched, setKeyTouched] = useState(!isNew);
    const [option, setOption] = useState('');
    const [preview, setPreview] = useState<CustomValue>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [pending, setPending] = useState(false);
    const set = (patch: Partial<FieldDefinitionInput>) => setDraft((current) => ({ ...current, ...patch }));
    const asDefinition = (extra: Partial<FieldDefinition>): FieldDefinition => ({ ...draft, id: id ?? 'new', sort: 0, ...extra });

    const addOption = () => {
        const value = option.trim();
        if (!value || draft.options.includes(value)) return;
        set({ options: [...draft.options, value] });
        setOption('');
    };

    const submit = async () => {
        if (!draft.label.trim()) {
            setErrors({ label: t('fields.error.label_missing') });
            return;
        }
        setPending(true);
        try {
            const saved = await saveFieldDefinition(draft, id);
            toast.success(t(isNew ? 'fields.created' : 'fields.saved', { label: saved.label }));
            onClose();
        } catch (error) {
            if (error instanceof ApiError && error.status === 422) setErrors(error.fieldErrors());
            else toast.error(errorMessage(error));
        } finally {
            setPending(false);
        }
    };

    return (
        <Drawer
            open
            onClose={onClose}
            title={isNew ? t('fields.add') : t('fields.edit_named', { label: initial.label })}
            description={t('fields.level', { level: t(`fields.scope.${draft.scope}`) })}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" pending={pending} onClick={() => void submit()}>
                        {isNew ? t('fields.create') : t('fields.save')}
                    </Button>
                </>
            }
        >
            <form
                className="grid gap-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                }}
            >
                <TextInput
                    label={t('fields.label')}
                    value={draft.label}
                    data-autofocus
                    placeholder={t('fields.label_placeholder')}
                    error={errors.label}
                    onChange={(e) => set({ label: e.target.value, ...(isNew && !keyTouched ? { key: slugKey(e.target.value) } : {}) })}
                />
                <TextInput
                    label={t('fields.key')}
                    value={draft.key}
                    readOnly={!isNew}
                    className="font-mono"
                    error={errors.key}
                    hint={isNew ? t('fields.key_hint_new') : t('fields.key_hint_fixed')}
                    onChange={(e) => {
                        setKeyTouched(true);
                        set({ key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') });
                    }}
                />
                <Field label={t('fields.type')} error={errors.type}>
                    {() => (
                        <div role="radiogroup" aria-label={t('fields.type')} className="grid grid-cols-2 gap-1.5 xs:grid-cols-4">
                            {TYPES.map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    role="radio"
                                    aria-checked={draft.type === type}
                                    onClick={() => set({ type, default_value: null, options: type === 'select' ? draft.options : [] })}
                                    className={cx(
                                        'h-9 truncate rounded-md px-2 text-sm font-strong transition-colors',
                                        draft.type === type ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted hover:bg-surface-3 hover:text-ink',
                                    )}
                                >
                                    {t(`fields.type.${type}`)}
                                </button>
                            ))}
                        </div>
                    )}
                </Field>

                {draft.type === 'select' && (
                    <Field label={t('fields.options')} error={errors.options}>
                        {(fieldId) => (
                            <div className="grid gap-2">
                                {draft.options.length > 0 && (
                                    <ul className="m-0 grid list-none gap-1 p-0">
                                        {draft.options.map((value) => (
                                            <li key={value} className="flex items-center justify-between gap-2 rounded-md bg-surface-2 py-0.5 pr-1 pl-3">
                                                <span>{value}</span>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    iconOnly
                                                    icon={<X />}
                                                    onClick={() => set({ options: draft.options.filter((o) => o !== value), default_value: draft.default_value === value ? null : draft.default_value })}
                                                >
                                                    {t('fields.option_remove', { option: value })}
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <div className="flex gap-2">
                                    <input
                                        id={fieldId}
                                        className={controlClass(false, 'h-control')}
                                        value={option}
                                        placeholder={t('fields.option_new')}
                                        onChange={(e) => setOption(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addOption();
                                            }
                                        }}
                                    />
                                    <Button icon={<Plus />} disabled={!option.trim()} onClick={addOption}>
                                        {t('fields.option_add')}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Field>
                )}

                {hasDocTypes(draft.scope) && (
                    <Field label={t('fields.applies_to')} hint={t('fields.applies_to_hint')} error={errors.doc_types}>
                        {() => (
                            <div className="flex flex-wrap gap-x-4 gap-y-2">
                                {DOCUMENT_TYPES.map((type) => (
                                    <Checkbox
                                        key={type}
                                        label={t(`document_type.${type}`)}
                                        checked={draft.doc_types.includes(type)}
                                        onChange={(e) => set({ doc_types: e.target.checked ? DOCUMENT_TYPES.filter((x) => x === type || draft.doc_types.includes(x)) : draft.doc_types.filter((x) => x !== type) })}
                                    />
                                ))}
                            </div>
                        )}
                    </Field>
                )}

                <Switch label={t('fields.required_label')} checked={draft.required} onChange={(e) => set({ required: e.target.checked })} />

                {draft.type !== 'image' && (
                    <CustomFieldInput
                        definition={asDefinition({ label: t('fields.default_value'), required: false, help: t('fields.default_value_hint') })}
                        value={draft.default_value}
                        error={errors.default_value}
                        onChange={(value) => set({ default_value: value })}
                    />
                )}

                <Textarea label={t('fields.help')} rows={2} value={draft.help} placeholder={t('fields.help_placeholder')} onChange={(e) => set({ help: e.target.value })} />
            </form>

            <section aria-label={t('fields.preview')} className="mt-5 grid gap-3 rounded-lg bg-surface-2 p-4">
                <p className="text-sm font-strong">{t('fields.preview')}</p>
                <div className="rounded-md bg-surface p-4">
                    <CustomFieldInput definition={asDefinition({ label: draft.label || t('fields.new_field') })} value={preview ?? draft.default_value} onChange={setPreview} />
                </div>
                <p className="text-muted">
                    {t('fields.in_template')} <code className="rounded-sm bg-surface px-1 font-mono text-xs">{`{{ ${liquidPath(draft.scope, draft.key || 'key')} }}`}</code>
                </p>
            </section>
        </Drawer>
    );
}
