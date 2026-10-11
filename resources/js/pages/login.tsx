import { Head, useForm } from '@inertiajs/react';
import { LocaleSwitch } from '@/components/locale-switch';
import { path, t } from '@/lib/i18n';

const field = 'h-[2.375rem] w-full rounded-md bg-surface-2 px-3 text-ink placeholder:text-faint';

export default function Login() {
    const form = useForm({ email: '', password: '' });

    return (
        <main className="relative grid min-h-dvh place-items-center px-6 py-16">
            <Head title={t('login.title')} />
            <div className="absolute top-4 right-6">
                <LocaleSwitch />
            </div>
            <div className="w-full max-w-sm rounded-xl bg-surface p-8">
                <p className="text-xl font-bold tracking-tight">openbill</p>
                <h1 className="sr-only">{t('login.title')}</h1>
                <form
                    className="mt-8 grid gap-5"
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.post(path('/login'), { onFinish: () => form.reset('password') });
                    }}
                >
                    <div className="grid gap-2">
                        <label htmlFor="email" className="font-medium">
                            {t('login.email')}
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="username"
                            spellCheck={false}
                            className={field}
                            value={form.data.email}
                            onChange={(e) => form.setData('email', e.target.value)}
                            aria-invalid={!!form.errors.email}
                            aria-describedby={form.errors.email ? 'login-error' : undefined}
                            autoFocus
                            required
                        />
                    </div>
                    <div className="grid gap-2">
                        <label htmlFor="password" className="font-medium">
                            {t('login.password')}
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            className={field}
                            value={form.data.password}
                            onChange={(e) => form.setData('password', e.target.value)}
                            required
                        />
                    </div>
                    {form.errors.email && (
                        <p id="login-error" role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-bad">
                            {form.errors.email}
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={form.processing}
                        className="mt-2 h-[2.375rem] rounded-full bg-accent font-medium text-accent-ink hover:bg-accent-hover disabled:opacity-60"
                    >
                        {t('login.submit')}
                    </button>
                </form>
            </div>
        </main>
    );
}
