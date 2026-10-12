<?php

namespace App\Support;

use App\Models\PersonalAccessToken;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/** Tokens of one user as the settings page "API & MCP" shows them (never the secret). */
final class ApiTokens
{
    /**
     * @return Builder<PersonalAccessToken>
     */
    public static function ownedBy(string $userId): Builder
    {
        return PersonalAccessToken::query()
            ->where('tokenable_type', (new User)->getMorphClass())
            ->where('tokenable_id', $userId);
    }

    /**
     * @return array{id: string, name: string, abilities: list<string>, template_id: string|null, template_name: string|null, is_toolkit: bool, created_at: string|null, last_used_at: string|null, expires_at: string|null}
     */
    public static function row(PersonalAccessToken $token): array
    {
        return [
            'id' => (string) $token->getKey(),
            'name' => (string) $token->name,
            'abilities' => array_values(array_map('strval', $token->abilities ?? [])),
            'template_id' => $token->template_id,
            'template_name' => $token->template?->name,
            // toolkit tokens (phase 9) write one template; they are listed here but created in the template editor
            'is_toolkit' => $token->template_id !== null,
            'created_at' => $token->created_at?->toAtomString(),
            'last_used_at' => $token->last_used_at?->toAtomString(),
            'expires_at' => $token->expires_at?->toAtomString(),
        ];
    }
}
