import { useSyncExternalStore } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

/** Same key and rule as the inline script in resources/views/app.blade.php (it runs before the first paint). */
const KEY = 'openbill:theme';
const listeners = new Set<() => void>();
let current: ThemePref | null = null;

export function isThemePref(value: unknown): value is ThemePref {
    return value === 'system' || value === 'light' || value === 'dark';
}

export function resolveTheme(pref: ThemePref, prefersDark: boolean): Theme {
    return pref === 'dark' || (pref === 'system' && prefersDark) ? 'dark' : 'light';
}

export function readThemePref(): ThemePref {
    try {
        const value = window.localStorage.getItem(KEY);
        return isThemePref(value) ? value : 'system';
    } catch {
        return 'system';
    }
}

export function getThemePref(): ThemePref {
    current ??= readThemePref();
    return current;
}

const prefersDark = (): boolean => window.matchMedia('(prefers-color-scheme: dark)').matches;

/** Sets data-theme on <html>; every color token switches with it. */
export function applyTheme(pref: ThemePref = getThemePref()): void {
    document.documentElement.dataset.theme = resolveTheme(pref, prefersDark());
}

export function setThemePref(pref: ThemePref): void {
    current = pref;
    try {
        window.localStorage.setItem(KEY, pref);
    } catch {
        // storage blocked (private mode): the choice lasts until the next page load
    }
    applyTheme(pref);
    listeners.forEach((listener) => listener());
}

/** Follows changes of the OS setting while the preference is "system". Call once (app.tsx). */
export function watchSystemTheme(): () => void {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
        if (getThemePref() === 'system') applyTheme('system');
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useThemePref(): ThemePref {
    return useSyncExternalStore(subscribe, getThemePref, () => 'system');
}
