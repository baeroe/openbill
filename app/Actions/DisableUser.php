<?php

namespace App\Actions;

use App\Exceptions\ActionNotAllowedException;
use App\Exceptions\OwnerRequiredException;
use App\Models\User;
use App\Models\UserInvitation;
use App\Support\Actor;
use App\Support\Owners;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * POST /api/users/{id}/disable: owners only, never oneself, never the last active owner. The account stays (documents
 * and their events keep their author); its API tokens, sessions and open invitations are revoked and the remember
 * cookie stops working.
 * Logging in is refused with its own message (LoginRequest), the provider never returns the account again.
 */
final class DisableUser
{
    /**
     * @throws OwnerRequiredException|ActionNotAllowedException
     */
    public function handle(Actor $actor, User $user): User
    {
        $owner = Owners::assertOwner($actor);
        if ($owner->id === $user->id) {
            throw ActionNotAllowedException::cannotDisableSelf();
        }

        return DB::transaction(function () use ($user): User {
            if (Owners::lockActive() === [$user->id]) {
                throw ActionNotAllowedException::lastOwner();
            }
            $user->tokens()->delete();
            // links they handed out must not bring them (or anyone) back in
            UserInvitation::query()->where('invited_by_id', $user->id)->whereNull('accepted_at')->delete();
            DB::table('sessions')->where('user_id', $user->id)->delete();
            $user->forceFill(['disabled_at' => $user->disabled_at ?? now(), 'remember_token' => Str::random(60)])->save();

            return $user;
        });
    }
}
