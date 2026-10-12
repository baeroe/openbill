<?php

namespace App\Actions;

use App\Exceptions\OwnerRequiredException;
use App\Models\User;
use App\Support\Actor;
use App\Support\Owners;

/** POST /api/users/{id}/enable: owners only; the account can log in again (old tokens stay revoked). */
final class EnableUser
{
    /**
     * @throws OwnerRequiredException
     */
    public function handle(Actor $actor, User $user): User
    {
        Owners::assertOwner($actor);
        $user->forceFill(['disabled_at' => null])->save();

        return $user;
    }
}
