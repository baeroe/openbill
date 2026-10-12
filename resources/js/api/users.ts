import useSWR, { mutate } from 'swr';
import { api } from '@/lib/api';
import type { UserRole } from '@/types';
import { keys } from './keys';

/** disabled_at: the account cannot log in (disabled, never deleted: documents keep their author). */
export type UserRow = { id: string; name: string; email: string; role: UserRole; is_self: boolean; disabled_at: string | null };
export type InvitationRow = { id: string; email: string; role: UserRole; expires_at: string; link: string | null };
export type UsersResponse = { users: UserRow[]; invitations: InvitationRow[] };

export function useUsers() {
    return useSWR<UsersResponse>(keys.users());
}

const refresh = () => mutate(keys.users());

export async function inviteUser(email: string, role: UserRole): Promise<InvitationRow> {
    const invitation = await api<InvitationRow>('/api/invitations', { method: 'POST', body: { email, role } });
    void refresh();
    return invitation;
}

export async function revokeInvitation(id: string): Promise<void> {
    await api<void>(`/api/invitations/${id}`, { method: 'DELETE' });
    void refresh();
}

export async function changeUserRole(id: string, role: UserRole): Promise<UserRow> {
    const user = await api<UserRow>(`/api/users/${id}`, { method: 'PATCH', body: { role } });
    void refresh();
    return user;
}

export async function disableUser(id: string): Promise<UserRow> {
    const user = await api<UserRow>(`/api/users/${id}/disable`, { method: 'POST', body: {} });
    void refresh();
    return user;
}

export async function enableUser(id: string): Promise<UserRow> {
    const user = await api<UserRow>(`/api/users/${id}/enable`, { method: 'POST', body: {} });
    void refresh();
    return user;
}

/** Clipboard when allowed (HTTPS, user gesture); false lets the caller show the link for manual copying. */
export async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}
