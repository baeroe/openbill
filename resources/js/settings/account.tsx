import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import { changePassword, type PasswordChange } from '@/api/account';
import { Button, CardHead, TextInput } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import type { SharedProps } from '@/types';
import { SettingsCard } from './settings-card';

const EMPTY: PasswordChange = { current_password: '', password: '', password_confirmation: '' };

/** Settings → Your account: who is signed in and the own password (current one required, other sessions end). */
export function AccountSettings() {
    const { auth } = usePage<SharedProps>().props;
    const [form, setForm] = useState<PasswordChange>(EMPTY);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [pending, setPending] = useState(false);
    const set = (patch: Partial<PasswordChange>) => setForm((current) => ({ ...current, ...patch }));

    const submit = async () => {
        setPending(true);
        try {
            await changePassword(form);
            setForm(EMPTY);
            setErrors({});
            toast.success(t('account.password_changed'));
        } catch (error) {
            if (error instanceof ApiError && error.status === 422) setErrors(error.fieldErrors());
            else toast.error(errorMessage(error));
        } finally {
            setPending(false);
        }
    };

    return (
        <div className="grid gap-6">
            <SettingsCard>
                <CardHead title={t('account.title')} description={t('account.text')} />
                <dl className="m-0 mt-4 grid gap-x-6 gap-y-1 text-md sm:grid-cols-[auto_minmax(0,1fr)]">
                    <dt className="text-muted">{t('account.name')}</dt>
                    <dd className="m-0 truncate font-strong">{auth.user?.name}</dd>
                    <dt className="text-muted">{t('account.email')}</dt>
                    <dd className="m-0 truncate font-strong">{auth.user?.email}</dd>
                </dl>
            </SettingsCard>
            <SettingsCard>
                <CardHead title={t('account.password_title')} description={t('account.password_text')} />
                <form
                    noValidate
                    className="mt-4 grid max-w-md gap-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void submit();
                    }}
                >
                    {/* lets password managers attach the new password to the right account */}
                    <input type="hidden" name="username" autoComplete="username" value={auth.user?.email ?? ''} />
                    <TextInput
                        label={t('account.current_password')}
                        type="password"
                        autoComplete="current-password"
                        value={form.current_password}
                        error={errors.current_password}
                        onChange={(e) => set({ current_password: e.target.value })}
                    />
                    <TextInput
                        label={t('account.new_password')}
                        type="password"
                        autoComplete="new-password"
                        hint={t('account.new_password_hint')}
                        value={form.password}
                        error={errors.password}
                        onChange={(e) => set({ password: e.target.value })}
                    />
                    <TextInput
                        label={t('account.confirm_password')}
                        type="password"
                        autoComplete="new-password"
                        value={form.password_confirmation}
                        error={errors.password_confirmation}
                        onChange={(e) => set({ password_confirmation: e.target.value })}
                    />
                    <div>
                        <Button type="submit" variant="primary" pending={pending} disabled={!form.current_password || !form.password}>
                            {t('account.change_password')}
                        </Button>
                    </div>
                </form>
            </SettingsCard>
        </div>
    );
}
