<?php

namespace App\Support;

use App\Enums\UserRole;
use App\Exceptions\OwnerRequiredException;
use App\Models\User;

/** Who may manage users: an active owner (session user or token owner). */
final class Owners
{
    /** The owner behind the actor (session user or token owner). */
    public static function assertOwner(Actor $actor): User
    {
        $user = $actor->userId === null ? null : User::query()->find($actor->userId);
        if (! $user instanceof User || $user->role !== UserRole::Owner || $user->isDisabled()) {
            throw new OwnerRequiredException;
        }

        return $user;
    }

    public static function isOwner(Actor $actor): bool
    {
        return $actor->userId !== null && User::query()->whereKey($actor->userId)->where('role', UserRole::Owner)->whereNull('disabled_at')->exists();
    }

    /**
     * Ids of the active owners, locked until the end of the transaction (two owners at once cannot demote or
     * disable each other).
     *
     * @return list<string>
     */
    public static function lockActive(): array
    {
        return User::query()->where('role', UserRole::Owner)->whereNull('disabled_at')->lockForUpdate()->pluck('id')->all();
    }
}
