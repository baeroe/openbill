import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

/** The value, but only after it stopped changing for `delay` ms (search fields). */
export function useDebounced<T>(value: T, delay = 250): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

/**
 * Asks before the page is left while `active`: reload/close of the tab (browser dialog) and every Inertia
 * visit (sidebar, links, back link). The returned function switches the guard off for the own navigation
 * right after saving, before React has re-rendered with the clean state.
 */
export function useLeaveGuard(active: boolean, message: string): () => void {
    const activeRef = useRef(active);
    useEffect(() => {
        activeRef.current = active;
    }, [active]);

    useEffect(() => {
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            if (activeRef.current) event.preventDefault();
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        const off = router.on('before', (event) => {
            if (activeRef.current && !window.confirm(message)) event.preventDefault();
        });
        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            off();
        };
    }, [message]);

    return () => {
        activeRef.current = false;
    };
}
