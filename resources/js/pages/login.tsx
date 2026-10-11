import { Head, useForm } from '@inertiajs/react';
import { LogIn } from 'lucide-react';
import { LocaleSwitch } from '@/components/locale-switch';
import { Badge, Button, Checkbox, TextInput } from '@/components/ui';
import { LogoMark } from '@/layouts/logo';
import { formatMoney } from '@/lib/format';
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
            <div aria-hidden className="relative hidden place-items-center overflow-hidden rounded-xl bg-surface-2 p-10 md:grid">
                <LoginArt />
            </div>
        </main>
    );
}

/** Two sheets of paper, a total and a "paid" chip. Decorative; paper stays white in dark mode as well. */
function LoginArt() {
    const line = (width: string) => <span className="block h-2 rounded-full bg-[#ecece9]" style={{ width }} />;
    const row = (left: string, right: string, group = false) => (
        <div className={group ? 'flex justify-between border-t border-[#ecece9] pt-2.5' : 'flex justify-between'}>
            {line(left)}
            {line(right)}
        </div>
    );

    return (
        <div className="relative aspect-[210/260] w-full max-w-[26rem]">
            <div className="absolute inset-0 grid -translate-x-[8%] translate-y-[3%] -rotate-5 content-start gap-2.5 rounded-[6px] bg-white p-[9%] opacity-70 shadow-paper">
                {line('40%')}
                {line('70%')}
                {line('55%')}
            </div>
            <div className="absolute inset-0 grid content-start gap-2.5 rounded-[6px] bg-white p-[9%] text-[13px] text-[#23252b] shadow-paper">
                <div className="mb-4 flex items-baseline justify-between">
                    <span className="block h-3 w-[38%] rounded-full bg-[#23252b]" />
                    {line('28%')}
                </div>
                {row('36%', '18%', true)}
                {row('52%', '16%')}
                {row('44%', '16%')}
                {row('30%', '18%', true)}
                {row('48%', '16%')}
                <div className="num mt-4 flex justify-between rounded-[10px] bg-[#e3e9fb] px-3 py-2.5 font-bold text-[#2f55d4]">
                    <span>{t('template.total')}</span>
                    <span>{formatMoney('9650.90')}</span>
                </div>
            </div>
            <div className="absolute right-[-6%] bottom-[10%] flex items-center gap-2 rounded-full bg-surface py-2 pr-3.5 pl-2 shadow-float">
                <Badge tone="ok">{t('status.paid')}</Badge>
            </div>
        </div>
    );
}
