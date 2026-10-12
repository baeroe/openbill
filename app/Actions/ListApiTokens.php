<?php

namespace App\Actions;

use App\Models\PersonalAccessToken;
use App\Support\Actor;
use App\Support\ApiTokens;

/** GET /api/tokens: the tokens of the signed-in user, newest first (owners see only their own, too). */
final class ListApiTokens
{
    /**
     * @return list<array<string, mixed>>
     */
    public function handle(Actor $actor): array
    {
        return ApiTokens::ownedBy((string) $actor->userId)
            ->with('template')
            ->orderByDesc('created_at')->orderByDesc('id')
            ->get()
            ->map(fn (PersonalAccessToken $token): array => ApiTokens::row($token))
            ->values()
            ->all();
    }
}
