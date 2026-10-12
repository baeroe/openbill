import useSWR, { mutate } from 'swr';
import { api } from '@/lib/api';
import { keys } from './keys';

/** Abilities the settings page gives; templates:write (toolkit, one template) comes from the template editor. */
export const TOKEN_ABILITIES = ['mcp', 'api:read', 'api:write', 'templates:render'] as const;
export type TokenAbility = (typeof TOKEN_ABILITIES)[number] | 'templates:write';

/** One token of the signed-in user (GET /api/tokens); the secret is never part of it. */
export type TokenRow = {
    id: string;
    name: string;
    abilities: TokenAbility[];
    template_id: string | null;
    template_name: string | null;
    is_toolkit: boolean;
    created_at: string | null;
    last_used_at: string | null;
    expires_at: string | null;
};

/** Answer of POST /api/tokens: the only time the plain-text token is shown. */
export type NewToken = { token: TokenRow; plain_text_token: string };

/** Translation key part of an ability: "api:read" → "api_read" (tokens.ability.api_read). */
export const abilityKey = (ability: string): string => ability.replace(':', '_');

export function useTokens() {
    return useSWR<TokenRow[]>(keys.tokens());
}

const refresh = () => mutate(keys.tokens());

export async function createToken(name: string, abilities: TokenAbility[]): Promise<NewToken> {
    const created = await api<NewToken>('/api/tokens', { method: 'POST', body: { name, abilities } });
    void refresh();
    return created;
}

export async function revokeToken(id: string): Promise<void> {
    await api<void>(`/api/tokens/${id}`, { method: 'DELETE' });
    void refresh();
}
