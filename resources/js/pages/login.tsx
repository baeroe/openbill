import { Head, useForm } from '@inertiajs/react';
import { LogIn } from 'lucide-react';
import { LocaleSwitch } from '@/components/locale-switch';
import { LoginArt } from '@/components/login-art';
// direct imports, not the ui barrel: the barrel re-exports Radix dialogs and menus the login does not need
import { Button } from '@/components/ui/button';
import { Checkbox, TextInput } from '@/components/ui/form';
import { LogoMark } from '@/layouts/logo';
import { path, t } from '@/lib/i18n';

export default function Login() {
    const form = useForm({ email: '', password: '', remember: false });

    return (
        <main className="grid min-h-dvh gap-3 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <Head title={t('login.title')} />
            <div className="relative grid content-center justify-items-start gap-8 px-3 py-12 sm:px-[clamp(1.5rem,6vw,6rem)]">
                <div className="absolute top-1 right-1">
                    <LocaleSwitch />
                </div>
                <div className="flex items-center gap-2.5 text-xl font-bold tracking-brand">
                    <LogoMark />
                    <span>openbill</span>
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-brand">{t('login.welcome')}</h1>
                    <p className="mt-2 max-w-[34ch] text-muted">{t('login.lead')}</p>
                </div>
                {/* noValidate: the server answers in the page language (lang/de/validation.php) instead of the browser */}
                <form
                    noValidate
                    className="grid w-full max-w-sm gap-4"
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
            </div>
            <div className="relative hidden place-items-center overflow-hidden rounded-xl bg-surface-2 p-10 md:grid">
                <LoginArt />
            </div>
        </main>
    );
}
