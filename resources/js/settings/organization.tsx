import { ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useFieldDefinitions } from '@/api/fields';
import { logoUrl, removeLogo, saveOrganization, uploadLogo, useOrganization, type Organization, type OrganizationInput } from '@/api/settings';
import { CustomFieldInput } from '@/components/custom-field-input';
import { Button, ButtonLink, CardHead, ErrorState, Select, Skeleton, TextInput, cx } from '@/components/ui';
import { SettingsCard } from './settings-card';
import { jumpTo } from '@/editor/jump';
import { ApiError, errorMessage } from '@/lib/api';
import { useLeaveGuard } from '@/lib/hooks';
import { path, t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { uploadError } from '@/templates/import-button';
import { SaveBar } from './save-bar';

const TAXATION = ['regular', 'small_business'] as const;

/** ?focus=org.vat_id (links from the document editor's compliance panel): jump once the form is there. */
export function useFocusFromUrl(ready: boolean): void {
    const done = useRef(false);
    useEffect(() => {
        if (!ready || done.current) return;
        const focus = new URLSearchParams(window.location.search).get('focus');
        done.current = true;
        if (focus) requestAnimationFrame(() => jumpTo(focus));
    }, [ready]);
}

export function OrganizationSettings() {
    const organization = useOrganization();
    useFocusFromUrl(!!organization.data);

    if (organization.error) return <ErrorState error={organization.error} onRetry={() => void organization.mutate()} />;
    if (!organization.data) return <Skeleton h={420} r={18} />;
    return <OrganizationForm key={organization.data.updated_at ?? 'org'} saved={organization.data} />;
}

const inputOf = ({ id: _id, has_logo: _logo, updated_at: _updated, ...input }: Organization): OrganizationInput => input;

function OrganizationForm({ saved }: { saved: Organization }) {
    const [org, setOrg] = useState<OrganizationInput>(() => inputOf(saved));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [pending, setPending] = useState(false);
    const [logoPending, setLogoPending] = useState(false);
    const fields = useFieldDefinitions('org');
    const logoInput = useRef<HTMLInputElement>(null);
    const dirty = JSON.stringify(org) !== JSON.stringify(inputOf(saved));
    const releaseGuard = useLeaveGuard(dirty, t('settings.leave_confirm'));
    const set = (patch: Partial<OrganizationInput>) => setOrg((current) => ({ ...current, ...patch }));
    const text = (key: keyof OrganizationInput, label: string, extra: Partial<Parameters<typeof TextInput>[0]> = {}) => (
        <TextInput label={label} value={String(org[key] ?? '')} error={errors[key]} onChange={(e) => set({ [key]: e.target.value } as Partial<OrganizationInput>)} {...extra} />
    );

    const submit = async () => {
        setPending(true);
        try {
            await saveOrganization(org);
            releaseGuard();
            setErrors({});
            toast.success(t('settings.org_saved'));
        } catch (error) {
            if (error instanceof ApiError && error.status === 422) setErrors(error.fieldErrors());
            toast.error(errorMessage(error));
        } finally {
            setPending(false);
        }
    };

    const onLogo = async (file: File | undefined) => {
        if (!file) return;
        setLogoPending(true);
        try {
            await uploadLogo(file);
            toast.success(t('settings.logo_saved'));
        } catch (error) {
            toast.error(uploadError(error));
        } finally {
            setLogoPending(false);
        }
    };

    return (
        <form
            noValidate
            className="grid gap-6"
            onSubmit={(e) => {
                e.preventDefault();
                void submit();
            }}
        >
            <SettingsCard aria-labelledby="org-company">
                <CardHead titleId="org-company" title={t('settings.company')} description={t('settings.company_text')} />
                <div className="grid gap-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className={cx('grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface p-2')}>
                            {saved.has_logo ? <img src={logoUrl(saved)} alt={t('settings.logo')} className="max-h-full max-w-full object-contain" /> : <span className="text-xl font-bold tracking-brand text-faint">{(org.name || 'Lo').slice(0, 2)}</span>}
                        </div>
                        <div className="grid gap-2">
                            <div className="flex flex-wrap gap-2">
                                <input
                                    ref={logoInput}
                                    type="file"
                                    accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                                    hidden
                                    onChange={(e) => {
                                        void onLogo(e.target.files?.[0]);
                                        e.target.value = '';
                                    }}
                                />
                                <Button size="sm" icon={<ImagePlus />} pending={logoPending} onClick={() => logoInput.current?.click()}>
                                    {saved.has_logo ? t('settings.logo_replace') : t('settings.logo_upload')}
                                </Button>
                                {saved.has_logo && (
                                    <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => void removeLogo().catch((error: unknown) => toast.error(errorMessage(error)))}>
                                        {t('settings.logo_remove')}
                                    </Button>
                                )}
                            </div>
                            <p className="text-xs text-muted">{t('settings.logo_hint')}</p>
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2" data-path="org.address">
                        {text('name', t('settings.org_name'), { wrapClassName: 'sm:col-span-2' })}
                        {text('street', t('settings.street'), { wrapClassName: 'sm:col-span-2' })}
                        {text('zip', t('settings.zip'))}
                        {text('city', t('settings.city'))}
                        {text('country', t('settings.country'), { maxLength: 2, hint: t('settings.country_hint') })}
                    </div>
                </div>
            </SettingsCard>

            <SettingsCard aria-labelledby="org-tax">
                <CardHead titleId="org-tax" title={t('settings.taxation')} description={t('settings.taxation_text')} />
                <div role="radiogroup" aria-labelledby="org-tax" className="grid gap-3 sm:grid-cols-2">
                    {TAXATION.map((mode) => (
                        <label
                            key={mode}
                            className={cx('relative grid cursor-pointer gap-1 rounded-lg py-4 pr-4 pl-11 transition-colors', org.taxation_mode === mode ? 'bg-accent-soft' : 'bg-surface hover:bg-surface-2')}
                        >
                            <input type="radio" name="taxation_mode" value={mode} checked={org.taxation_mode === mode} onChange={() => set({ taxation_mode: mode })} className="absolute top-[1.15rem] left-4 size-4 accent-[var(--accent)]" />
                            <span className={cx('font-heading', org.taxation_mode === mode && 'text-accent')}>{t(`settings.taxation.${mode}`)}</span>
                            <span className="text-sm text-muted">{t(`settings.taxation.${mode}_text`)}</span>
                        </label>
                    ))}
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {text('vat_id', t('settings.vat_id'), { placeholder: 'DE123456789', path: 'org.vat_id' })}
                    {text('tax_number', t('settings.tax_number'), { hint: t('settings.tax_number_hint') })}
                    {text('registration_id', t('settings.registration_id'), { hint: t('settings.registration_id_hint'), path: 'org.registration_id', wrapClassName: 'sm:col-span-2' })}
                </div>
            </SettingsCard>

            <SettingsCard aria-labelledby="org-bank">
                <CardHead titleId="org-bank" title={t('settings.bank_contact')} description={t('settings.bank_contact_text')} />
                <div className="grid gap-4 sm:grid-cols-2">
                    {text('iban', t('settings.iban'), { wrapClassName: 'sm:col-span-2', className: 'num', path: 'org.iban' })}
                    {text('bic', t('settings.bic'))}
                    {text('bank_name', t('settings.bank_name'))}
                    {text('email', t('settings.email'), { type: 'email' })}
                    {text('phone', t('settings.phone'), { type: 'tel' })}
                    {text('website', t('settings.website'))}
                    <Select label={t('settings.locale')} hint={t('settings.locale_hint')} value={org.locale} error={errors.locale} onChange={(e) => set({ locale: e.target.value })}>
                        <option value="de">Deutsch</option>
                        <option value="en">English</option>
                    </Select>
                </div>
            </SettingsCard>

            <SettingsCard aria-labelledby="org-fields">
                <CardHead
                    titleId="org-fields"
                    title={t('settings.custom_fields')}
                    description={t('settings.custom_fields_text')}
                    actions={
                        <ButtonLink href={path('/fields?scope=org')} size="sm" variant="soft">
                            {t('settings.manage_fields')}
                        </ButtonLink>
                    }
                />
                {(fields.data ?? []).length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {fields.data!.map((definition) => (
                            <CustomFieldInput
                                key={definition.id}
                                definition={definition}
                                path={`org.${definition.key}`}
                                value={org.custom[definition.key]}
                                error={errors[`custom.${definition.key}`]}
                                onChange={(value) => set({ custom: { ...org.custom, [definition.key]: value } })}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-muted">{t('settings.no_custom_fields')}</p>
                )}
            </SettingsCard>

            <SaveBar dirty={dirty} pending={pending} onReset={() => setOrg(inputOf(saved))} />
        </form>
    );
}
