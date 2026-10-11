type Translations = Record<string, string>;

let locale = 'en';
let translations: Translations = {};

/** Set once per page load from the shared Inertia props; switching the language reloads the page. */
export function initI18n(props: { locale?: string; translations?: Translations }): void {
    locale = props.locale ?? 'en';
    translations = props.translations ?? {};
}

export function getLocale(): string {
    return locale;
}

/** Translation for a key with :placeholders filled in. A missing key shows up as the key itself. */
export function t(key: string, params: Record<string, string | number> = {}): string {
    let text = translations[key] ?? key;
    for (const [name, value] of Object.entries(params)) text = text.replaceAll(`:${name}`, String(value));
    return text;
}

/** Singular/plural pair key.one / key.other, :count filled in. */
export function tn(key: string, count: number): string {
    return t(count === 1 ? `${key}.one` : `${key}.other`, { count });
}

/** Admin URL in the current language: path('/documents') -> '/de/documents'. */
export function path(p: string): string {
    return `/${locale}${p}`;
}

/** The same page in another language. A full page load, because translations are loaded once per page. */
export function localeHref(target: string, location: { pathname: string; search: string } = window.location): string {
    return location.pathname.replace(/^\/(en|de)(?=\/|$)/, `/${target}`) + location.search;
}
