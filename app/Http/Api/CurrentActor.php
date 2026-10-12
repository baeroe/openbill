<?php

namespace App\Http\Api;

use App\Models\PersonalAccessToken;
use App\Models\User;
use App\Support\Actor;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;

/** Who calls the API: a token (actor = token, user kept) or the signed-in UI user (session). */
final class CurrentActor
{
    /**
     * @throws AuthenticationException
     */
    public static function from(Request $request): Actor
    {
        return self::forUser($request->user());
    }

    /**
     * The actor behind an authenticated user (also the MCP server, which has no Laravel request at hand).
     *
     * @throws AuthenticationException
     */
    public static function forUser(mixed $user): Actor
    {
        if (! $user instanceof User) {
            throw new AuthenticationException;
        }
        $token = $user->currentAccessToken();

        return $token instanceof PersonalAccessToken
            ? Actor::token((string) $token->getKey(), $user->id)
            : Actor::user($user);
    }
}
