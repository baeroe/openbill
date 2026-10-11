import { useCallback, useState } from 'react';

/** A yes/no preference of this browser (e.g. collapsed sidebar). Works without storage (private mode). */
export function useStoredFlag(key: string, initial = false): [boolean, (next: boolean) => void] {
    const [value, setValue] = useState<boolean>(() => {
        try {
            const stored = window.localStorage.getItem(key);
            return stored === null ? initial : stored === '1';
        } catch {
            return initial;
        }
    });

    const set = useCallback(
        (next: boolean) => {
            setValue(next);
            try {
                window.localStorage.setItem(key, next ? '1' : '0');
            } catch {
                // storage blocked: the choice lasts until the next page load
            }
        },
        [key],
    );

    return [value, set];
}
