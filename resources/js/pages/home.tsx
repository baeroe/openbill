import { Head, router, usePage } from '@inertiajs/react';
import { LocaleSwitch } from '@/components/locale-switch';
import { path, t } from '@/lib/i18n';
import type { SharedProps } from '@/types';

export default function Home() {
    const { auth } = usePage<SharedProps>().props;

    return (
        <main className="mx-auto grid min-h-dvh max-w-2xl content-center gap-6 px-6 py-16">
            <Head title={t('home.title')} />
            <header className="flex items-center justify-between gap-4">
                <h1 className="text-[1.625rem] font-bold tracking-tight">{t('home.title')}</h1>
                <LocaleSwitch />
            </header>
            <section className="grid gap-3 rounded-lg bg-surface p-8">
                <p>{t('home.signed_in_as', { name: auth.user?.name ?? '' })}</p>
                <p className="text-muted">{t('home.placeholder')}</p>
                <button
                    type="button"
                    onClick={() => router.post(path('/logout'))}
                    className="mt-2 h-8 justify-self-start rounded-full bg-surface-2 px-4 font-medium hover:bg-surface-3"
                >
                    {t('common.logout')}
                </button>
            </section>
        </main>
    );
}
