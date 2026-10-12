import { SWRConfig } from 'swr';
import { flushAutosaves, resetAutosaves } from '@/editor/autosave-registry';
import { useEditor } from '@/editor/store';
import { cookie } from '@/lib/api';
import { path, t } from '@/lib/i18n';
import { toast } from '@/lib/toast';

/** How long the logout waits for the last save of open documents (the save itself keeps running). */
export const LOGOUT_SAVE_WAIT = 3000;

export type LogoutOptions = {
    /** POST /{locale}/logout; rejects when the session could not be ended. */
    post?: () => Promise<void>;
    /** After a successful logout: a full page load of the login (no state of this person survives in the tab). */
    leave?: () => void;
    wait?: number;
};

async function postLogout(): Promise<void> {
    const xsrf = cookie('XSRF-TOKEN');
    const response = await fetch(path('/logout'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'text/html', 'X-Requested-With': 'XMLHttpRequest', ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}) },
    });
    if (!response.ok) throw new Error(`logout: ${response.status}`);
}

/**
 * Every cached API answer, also the useSWRInfinite pages (`$inf$…`) that a filter-mutate skips. Deleted straight from
 * SWR's default cache; the full page load right after starts with a new one anyway.
 */
export function clearApiCache(): void {
    const cache = SWRConfig.defaultValue.cache;
    for (const key of [...cache.keys()]) cache.delete(key);
}

let running = false;

/**
 * Saves what is open (at most `wait` ms), ends the session, and only then forgets drafts, autosaves and cached API
 * data: the next person in this tab sees none of it. A failed logout leaves everything running and says so.
 */
export async function logout({ post = postLogout, leave = () => window.location.assign(path('/login')), wait = LOGOUT_SAVE_WAIT }: LogoutOptions = {}): Promise<boolean> {
    if (running) return false;
    running = true;
    try {
        let timer: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([flushAutosaves(), new Promise<void>((resolve) => (timer = setTimeout(resolve, wait)))]);
        clearTimeout(timer);
        try {
            await post();
        } catch {
            toast.error(t('user_menu.logout_failed'));
            return false;
        }
        resetAutosaves();
        useEditor.getState().reset();
        clearApiCache();
        leave();
        return true;
    } finally {
        running = false;
    }
}
