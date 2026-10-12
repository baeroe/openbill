import { ListPlus } from 'lucide-react';
import { useState } from 'react';
import { useFieldDefinitions } from '@/api/fields';
import { useTextBlocks } from '@/api/master-data';
import { saveDocumentType, useDocumentTypes, useNumberPreview, type DocumentTypeInput, type DocumentTypeSetting } from '@/api/settings';
import { useTemplates } from '@/api/templates';
import { DOCUMENT_TYPES, type ComplianceProfile, type DocumentType } from '@/api/types';
import { Badge, ButtonLink, CardHead, Checkbox, ErrorState, Select, Skeleton, Tabs, TextInput, cx } from '@/components/ui';
import { SettingsCard } from './settings-card';
import { ApiError, errorMessage } from '@/lib/api';
import { useLeaveGuard } from '@/lib/hooks';
import { path, t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { SaveBar } from './save-bar';

const PLACEHOLDERS = ['{YYYY}', '{YY}', '{MM}', '{0000}'] as const;
const PLACEHOLDER_KEYS: Record<(typeof PLACEHOLDERS)[number], string> = { '{YYYY}': 'year_long', '{YY}': 'year_short', '{MM}': 'month', '{0000}': 'sequence' };

export function DocumentTypeSettings() {
    const [type, setType] = useState<DocumentType>('invoice');
    const settings = useDocumentTypes();
    const current = settings.data?.find((setting) => setting.type === type);

    return (
        <div className="grid gap-6">
            <Tabs<DocumentType> label={t('settings.doc_type_label')} value={type} onChange={setType} items={DOCUMENT_TYPES.map((value) => ({ value, label: t(`document_type.${value}`) }))} />
            {settings.error ? (
                <ErrorState error={settings.error} onRetry={() => void settings.mutate()} />
            ) : !current ? (
                <Skeleton h={420} r={18} />
            ) : (
                <DocumentTypeForm key={`${type}:${JSON.stringify(current)}`} saved={current} />
            )}
        </div>
    );
}

const inputOf = (setting: DocumentTypeSetting): DocumentTypeInput => ({
    profile: setting.profile,
    template_id: setting.template_id,
    default_intro_block_id: setting.default_intro_block_id,
    default_closing_block_id: setting.default_closing_block_id,
    payment_term_days: setting.payment_term_days,
    validity_days: setting.validity_days,
    numbering: { pattern: setting.numbering.pattern, reset_yearly: setting.numbering.reset_yearly, next_value: setting.numbering.next_value },
});

function DocumentTypeForm({ saved }: { saved: DocumentTypeSetting }) {
    const type = saved.type;
    const [form, setForm] = useState<DocumentTypeInput>(() => inputOf(saved));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [pending, setPending] = useState(false);
    const templates = useTemplates();
    const blocks = useTextBlocks();
    const documentFields = useFieldDefinitions('document');
    const positionFields = useFieldDefinitions('position');
    const preview = useNumberPreview(type, form.numbering.pattern, form.numbering.reset_yearly, form.numbering.next_value ?? null);
    const dirty = JSON.stringify(form) !== JSON.stringify(inputOf(saved));
    const releaseGuard = useLeaveGuard(dirty, t('settings.leave_confirm'));
    const set = (patch: Partial<DocumentTypeInput>) => setForm((current) => ({ ...current, ...patch }));
    const setNumbering = (patch: Partial<DocumentTypeInput['numbering']>) => setForm((current) => ({ ...current, numbering: { ...current.numbering, ...patch } }));
    const profiles: ComplianceProfile[] = type === 'invoice' || type === 'cancellation' ? ['basic', 'en16931'] : ['basic'];
    const templateOptions = (templates.data ?? []).filter((template) => template.document_types.includes(type) || template.id === form.template_id);
    const blockOptions = (kinds: string[]) => (blocks.data ?? []).filter((block) => kinds.includes(block.kind));
    const fieldsForType = [...(documentFields.data ?? []), ...(positionFields.data ?? [])].filter((field) => field.doc_types.includes(type));

    const submit = async () => {
        setPending(true);
        try {
            // send next_value only when it was changed: the counter may have moved since the page loaded
            const numbering = form.numbering.next_value === saved.numbering.next_value ? { pattern: form.numbering.pattern, reset_yearly: form.numbering.reset_yearly } : form.numbering;
            await saveDocumentType(type, { ...form, numbering });
            releaseGuard();
            setErrors({});
            toast.success(t('settings.doc_type_saved', { type: t(`document_type.${type}`) }));
        } catch (error) {
            if (error instanceof ApiError && error.status === 422) setErrors(error.fieldErrors());
            toast.error(errorMessage(error));
        } finally {
            setPending(false);
        }
    };

    const days = (key: 'payment_term_days' | 'validity_days', label: string) => (
        <TextInput
            label={label}
            type="number"
            min={0}
            max={365}
            inputMode="numeric"
            value={form[key] ?? ''}
            error={errors[key]}
            aside={<span className="rounded-full bg-surface-2 px-2 py-px text-xs">{t('settings.days')}</span>}
            onChange={(e) => set({ [key]: e.target.value === '' ? null : Math.max(0, Math.trunc(Number(e.target.value))) } as Partial<DocumentTypeInput>)}
        />
    );

    return (
        <form
            noValidate
            className="grid gap-6"
            onSubmit={(e) => {
                e.preventDefault();
                void submit();
            }}
        >
            <SettingsCard aria-labelledby="dt-profile">
                <CardHead titleId="dt-profile" title={t('settings.profile')} description={t('settings.profile_text')} />
                <div role="radiogroup" aria-labelledby="dt-profile" className="grid gap-3 sm:grid-cols-2">
                    {profiles.map((profile) => (
                        <label key={profile} className={cx('relative grid cursor-pointer gap-1 rounded-lg py-4 pr-4 pl-11 transition-colors', form.profile === profile ? 'bg-accent-soft' : 'bg-surface hover:bg-surface-2')}>
                            <input type="radio" name="profile" checked={form.profile === profile} onChange={() => set({ profile })} className="absolute top-[1.15rem] left-4 size-4 accent-[var(--accent)]" />
                            <span className={cx('font-heading', form.profile === profile && 'text-accent')}>{t(`editor.profile.${profile}`)}</span>
                            <span className="text-sm text-muted">{t(`settings.profile.${profile}_text`)}</span>
                        </label>
                    ))}
                </div>
                {profiles.length === 1 && <p className="mt-3 text-xs text-muted">{t('settings.profile_einvoice_only')}</p>}
            </SettingsCard>

            <SettingsCard aria-labelledby="dt-numbering">
                <CardHead titleId="dt-numbering" title={t('settings.numbering')} description={t('settings.numbering_text')} />
                <div className="grid items-start gap-5 sm:grid-cols-[minmax(0,1fr)_15rem]">
                    <div className="grid gap-4">
                        <TextInput
                            label={t('settings.pattern')}
                            value={form.numbering.pattern}
                            className="font-mono"
                            error={errors['numbering.pattern']}
                            onChange={(e) => setNumbering({ pattern: e.target.value })}
                        />
                        <div className="flex flex-wrap gap-1.5" aria-label={t('settings.placeholders')}>
                            {PLACEHOLDERS.map((token) => (
                                <button
                                    key={token}
                                    type="button"
                                    onClick={() => setNumbering({ pattern: form.numbering.pattern + token })}
                                    className="inline-flex h-[1.875rem] items-center gap-2 rounded-full bg-surface px-3 text-xs text-muted transition-colors hover:bg-accent-soft hover:text-accent"
                                >
                                    <code className="font-mono text-ink">{token}</code>
                                    <span>{t(`settings.placeholder.${PLACEHOLDER_KEYS[token]}`)}</span>
                                </button>
                            ))}
                        </div>
                        <Checkbox label={t('settings.reset_yearly')} checked={form.numbering.reset_yearly} onChange={(e) => setNumbering({ reset_yearly: e.target.checked })} />
                        <TextInput
                            label={t('settings.next_value')}
                            type="number"
                            min={1}
                            inputMode="numeric"
                            value={form.numbering.next_value ?? ''}
                            error={errors['numbering.next_value']}
                            hint={t('settings.next_value_hint')}
                            onChange={(e) => setNumbering({ next_value: e.target.value === '' ? undefined : Math.max(1, Math.trunc(Number(e.target.value))) })}
                        />
                    </div>
                    <div aria-live="polite" className="grid gap-1 rounded-lg bg-accent-soft p-5">
                        <span className="text-sm text-muted">{t('settings.next_number')}</span>
                        <strong className="num text-2xl font-bold tracking-brand break-all text-accent">{preview.data?.valid ? preview.data.number : '–'}</strong>
                        {preview.data && !preview.data.valid && <span className="text-xs text-bad">{preview.data.message}</span>}
                    </div>
                </div>
            </SettingsCard>

            <SettingsCard aria-labelledby="dt-defaults">
                <CardHead titleId="dt-defaults" title={t('settings.defaults')} description={t('settings.defaults_text')} />
                <div className="grid gap-4 sm:grid-cols-2">
                    <Select label={t('settings.template')} value={form.template_id ?? ''} error={errors.template_id} onChange={(e) => set({ template_id: e.target.value || null })}>
                        <option value="">{t('settings.template_default')}</option>
                        {templateOptions.map((template) => (
                            <option key={template.id} value={template.id}>
                                {template.name}
                            </option>
                        ))}
                    </Select>
                    {type === 'invoice' && days('payment_term_days', t('settings.payment_term'))}
                    {type === 'offer' && days('validity_days', t('settings.validity'))}
                    <Select label={t('settings.intro_block')} value={form.default_intro_block_id ?? ''} onChange={(e) => set({ default_intro_block_id: e.target.value || null })}>
                        <option value="">{t('settings.none')}</option>
                        {blockOptions(['intro', 'note']).map((block) => (
                            <option key={block.id} value={block.id}>
                                {block.name}
                            </option>
                        ))}
                    </Select>
                    <Select label={t('settings.closing_block')} value={form.default_closing_block_id ?? ''} onChange={(e) => set({ default_closing_block_id: e.target.value || null })}>
                        <option value="">{t('settings.none')}</option>
                        {blockOptions(['closing', 'payment', 'note']).map((block) => (
                            <option key={block.id} value={block.id}>
                                {block.name}
                            </option>
                        ))}
                    </Select>
                </div>
            </SettingsCard>

            <div className="flex flex-wrap items-center gap-4 rounded-lg bg-surface-2 px-5 py-4">
                <ListPlus aria-hidden className="size-5 shrink-0 text-muted" />
                <div className="grid min-w-0 gap-1">
                    <b className="font-strong">{t('settings.fields_for_type', { type: t(`document_type.${type}`) })}</b>
                    <div className="flex flex-wrap gap-1.5">
                        {fieldsForType.length === 0 && <span className="text-muted">{t('settings.none_yet')}</span>}
                        {fieldsForType.map((field) => (
                            <Badge key={field.id} plain tone={field.scope === 'position' ? 'accent' : 'neutral'}>
                                {field.scope === 'position' ? t('settings.position_field', { label: field.label }) : field.label}
                            </Badge>
                        ))}
                    </div>
                </div>
                <span className="flex-1" />
                <ButtonLink href={path('/fields?scope=document')} size="sm" variant="soft">
                    {t('settings.manage_fields')}
                </ButtonLink>
            </div>

            <SaveBar dirty={dirty} pending={pending} onReset={() => setForm(inputOf(saved))} />
        </form>
    );
}
