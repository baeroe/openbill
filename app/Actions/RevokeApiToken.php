<?php

namespace App\Actions;

use App\Models\PersonalAccessToken;
use App\Support\Actor;

/** The next request with this token gets 401. */
final class RevokeApiToken
{
    public function handle(Actor $actor, PersonalAccessToken $token): void
    {
        $token->delete();
    }
}
