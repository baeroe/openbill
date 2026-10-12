import { useCallback, useState } from 'react';

type FlagStorage = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): FlagStorage | undefined {
    try {
        return window.localStorage;
    } catch {
        return undefined;
    }
}

export function readFlag(key: string, fallback: boolean, storage: FlagStorage | undefined = browserStorage()): boolean {
    try {
        const value = storage?.getItem(key);
        return value === null || value === undefined ? fallback : value === '1';
    } catch {
        return fallback;
    }
}

export function writeFlag(key: string, value: boolean, storage: FlagStorage | undefined = browserStorage()): void {
    try {
        storage?.setItem(key, value ? '1' : '0');
    } catch {
        // private mode or blocked storage: the flag lasts for this page only
    }
}

/** A switch of the preview page that survives a reload (localStorage, never required). */
export function useStoredFlag(key: string, fallback: boolean): [boolean, (next: boolean) => void] {
    const [value, setValue] = useState(() => readFlag(key, fallback));
    const set = useCallback(
        (next: boolean) => {
            setValue(next);
            writeFlag(key, next);
        },
        [key],
    );
    return [value, set];
}
