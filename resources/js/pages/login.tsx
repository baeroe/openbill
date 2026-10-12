import { Head, useForm } from '@inertiajs/react';
import { LogIn } from 'lucide-react';
import { LocaleSwitch } from '@/components/locale-switch';
// direct imports, not the ui barrel: the barrel re-exports Radix dialogs and menus the login does not need
import { Button } from '@/components/ui/button';
import { Checkbox, TextInput } from '@/components/ui/form';
import { AuthCard } from '@/layouts/auth-card';
import { path, t } from '@/lib/i18n';

export default function Login() {
    const form = useForm({ email: '', password: '', remember: false });

    return (
        <AuthCard corner={<LocaleSwitch />}>
            <Head title={t('login.title')} />
            <div>
                <h1 className="text-2xl font-bold tracking-brand">{t('login.welcome')}</h1>
                <p className="mt-1.5 text-pretty text-muted">{t('login.lead')}</p>
            </div>
            {/* noValidate: the server answers in the page language (lang/de/validation.php) instead of the browser */}
            <form
                noValidate
                className="grid gap-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post(path('/login'), { onFinish: () => form.reset('password') });
                }}
            >
                <TextInput
                    label={t('login.email')}
                    name="email"
                    type="email"
                    autoComplete="username"
                    spellCheck={false}
                    autoFocus
                    value={form.data.email}
                    error={form.errors.email}
                    onChange={(e) => form.setData('email', e.target.value)}
                />
                <TextInput
                    label={t('login.password')}
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={form.data.password}
                    error={form.errors.password}
                    onChange={(e) => form.setData('password', e.target.value)}
                />
                <Checkbox label={t('login.remember')} name="remember" checked={form.data.remember} onChange={(e) => form.setData('remember', e.target.checked)} />
                <Button type="submit" variant="primary" icon={<LogIn />} pending={form.processing} className="mt-2">
                    {t('login.submit')}
                </Button>
            </form>
        </AuthCard>
    );
}
