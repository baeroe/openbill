import { Head, Link, useForm } from '@inertiajs/react';
import { UserCheck } from 'lucide-react';
import { Button, Notice, TextInput } from '@/components/ui';
import { LogoMark } from '@/layouts/logo';
import { path, t } from '@/lib/i18n';

type Props = { state: 'open' | 'expired' | 'closed'; email: string | null; role: 'owner' | 'member' | null };

/** Signed invitation link (/{locale}/invitations/{id}?signature=…): name and password, then signed in. */
export default function Invitation({ state, email, role }: Props) {
    const form = useForm({ name: '', password: '', password_confirmation: '' });
    const errors = form.errors as Record<string, string | undefined>;

    return (
        <main className="grid min-h-dvh content-center justify-items-start gap-8 px-6 py-12 sm:px-[clamp(1.5rem,8vw,8rem)]">
            <Head title={t('invitation.title')} />
            <div className="flex items-center gap-2.5 text-xl font-bold tracking-brand">
                <LogoMark />
                <span>openbill</span>
            </div>
            <div>
                <h1 className="text-3xl font-bold tracking-brand">{t('invitation.title')}</h1>
                {state === 'open' && email && role && <p className="mt-2 max-w-[44ch] text-muted">{t('invitation.lead', { email, role: t(`users.role.${role}`) })}</p>}
            </div>

            {state !== 'open' ? (
                <div className="grid max-w-sm gap-4">
                    <Notice tone="warn">{state === 'expired' ? t('invitation.expired') : t('invitations.closed')}</Notice>
                    <Link href={path('/login')}>{t('invitation.to_login')}</Link>
                </div>
            ) : (
                <form
                    noValidate
                    className="grid w-full max-w-sm gap-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        // the signature is part of the URL: post to exactly this address
                        form.post(window.location.pathname + window.location.search, { onFinish: () => form.reset('password', 'password_confirmation') });
                    }}
                >
                    {(errors.invitation || errors.email) && <Notice tone="bad">{errors.invitation ?? errors.email}</Notice>}
                    <TextInput label={t('invitation.email')} value={email ?? ''} readOnly autoComplete="username" />
                    <TextInput label={t('invitation.name')} autoComplete="name" autoFocus value={form.data.name} error={errors.name} onChange={(e) => form.setData('name', e.target.value)} />
                    <TextInput label={t('invitation.password')} type="password" autoComplete="new-password" value={form.data.password} error={errors.password} hint={t('invitation.password_hint')} onChange={(e) => form.setData('password', e.target.value)} />
                    <TextInput label={t('invitation.password_confirmation')} type="password" autoComplete="new-password" value={form.data.password_confirmation} onChange={(e) => form.setData('password_confirmation', e.target.value)} />
                    <Button type="submit" variant="primary" icon={<UserCheck />} pending={form.processing} className="mt-2">
                        {t('invitation.submit')}
                    </Button>
                </form>
            )}
        </main>
    );
}
