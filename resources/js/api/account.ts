import { api } from '@/lib/api';

export type PasswordChange = { current_password: string; password: string; password_confirmation: string };

/** PUT /api/account/password (session only): other sessions end, this one stays signed in. */
export async function changePassword(input: PasswordChange): Promise<void> {
    await api<void>('/api/account/password', { method: 'PUT', body: input });
}
