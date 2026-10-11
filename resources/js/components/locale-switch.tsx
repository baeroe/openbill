import { getLocale, localeHref, t } from '@/lib/i18n';
import type { Locale } from '@/types';

/** Same page in the other language (full page load, translations are loaded once per page). */
export function LocaleSwitch() {
    const labels: Record<Locale, string> = { en: t('locale.en'), de: t('locale.de') };

    return (
        <nav aria-label={t('locale.switch')} className="flex gap-1">
            {(Object.keys(labels) as Locale[]).map((locale) => (
                <a
                    key={locale}
                    href={localeHref(locale)}
                    lang={locale}
                    aria-current={locale === getLocale() ? 'true' : undefined}
                    className="inline-flex h-8 items-center rounded-full px-3 text-sm font-medium text-muted no-underline transition-colors hover:bg-surface-2 hover:text-ink aria-[current=true]:bg-ink aria-[current=true]:text-bg"
                >
                    {labels[locale]}
                </a>
            ))}
        </nav>
    );
}
