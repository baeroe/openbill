import { getLocale, t } from '@/lib/i18n';
import type { Locale } from '@/types';

/** Same page in the other language. A full page load, because translations are loaded once per page. */
export function LocaleSwitch() {
    const labels: Record<Locale, string> = { en: t('locale.en'), de: t('locale.de') };
    const href = (locale: Locale) =>
        window.location.pathname.replace(/^\/(en|de)(?=\/|$)/, `/${locale}`) + window.location.search;

    return (
        <nav aria-label={t('locale.switch')} className="flex gap-1">
            {(Object.keys(labels) as Locale[]).map((locale) => (
                <a
                    key={locale}
                    href={href(locale)}
                    lang={locale}
                    aria-current={locale === getLocale() ? 'true' : undefined}
                    className="rounded-full px-3 py-1 text-muted hover:bg-surface-2 aria-[current=true]:bg-accent-soft aria-[current=true]:text-accent"
                >
                    {labels[locale]}
                </a>
            ))}
        </nav>
    );
}
