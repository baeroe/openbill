import { SWRConfig } from 'swr';
import { flushAutosaves, resetAutosaves } from '@/editor/autosave-registry';
import { useEditor } from '@/editor/store';
import { clearDrafts } from '@/editor/unsaved-drafts';
import { cookie } from '@/lib/api';
import { path, t } from '@/lib/i18n';
import { flushPendingDeletes } from '@/lib/pending-delete';
import { dismissToast, toast } from '@/lib/toast';

/** How long the logout waits for the last save of open documents and for pending deletes (both keep running after). */
export const LOGOUT_SAVE_WAIT = 3000;
/** How long POST /logout may take before the logout counts as failed (a hanging request must not block the person). */
export const LOGOUT_POST_TIMEOUT = 10000;

export type LogoutOptions = {
    /** POST /{locale}/logout; resolves once the session is over (also when it had ended already), rejects otherwise. */
    post?: (signal: AbortSignal) => Promise<void>;
    /** After a successful logout: a full page load of the login (no state of this person survives in the tab). */
    leave?: () => void;
    wait?: number;
    timeout?: number;
};

/** 401/419: the session ended on its own (expired, or logged out in another tab) – which is what logging out wants. */
export async function postLogout(signal: AbortSignal): Promise<void> {
    const xsrf = cookie('XSRF-TOKEN');
    const response = await fetch(path('/logout'), {
        method: 'POST',
        credentials: 'same-origin',
        signal,
        headers: { Accept: 'text/html', 'X-Requested-With': 'XMLHttpRequest', ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}) },
    });
    if (response.status === 401 || response.status === 419) return;
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
 * Saves what is open and sends pending deletes (at most `wait` ms), ends the session (at most `timeout` ms), and only
 * then forgets drafts, autosaves and cached API data: the next person in this tab sees none of it. A failed logout
 * leaves everything running and says so.
 */
export async function logout({
    post = postLogout,
    leave = () => window.location.assign(path('/login')),
    wait = LOGOUT_SAVE_WAIT,
    timeout = LOGOUT_POST_TIMEOUT,
}: LogoutOptions = {}): Promise<boolean> {
    if (running) return false;
    running = true;
    // the menu is closed already: say that something is happening (saving may take up to `wait`)
    const notice = toast.info(t('user_menu.logging_out'));
    try {
        let timer: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([Promise.all([flushAutosaves(), flushPendingDeletes()]), new Promise<void>((resolve) => (timer = setTimeout(resolve, wait)))]);
        clearTimeout(timer);
        const controller = new AbortController();
        const abort = setTimeout(() => controller.abort(), timeout);
        try {
            await post(controller.signal);
        } catch {
            dismissToast(notice);
            toast.error(t('user_menu.logout_failed'));
            return false;
        } finally {
            clearTimeout(abort);
        }
        resetAutosaves();
        useEditor.getState().reset();
        clearApiCache();
        clearDrafts();
        leave();
        return true;
    } finally {
        running = false;
    }
}
