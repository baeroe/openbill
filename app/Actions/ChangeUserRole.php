<?php

namespace App\Actions;

use App\Enums\UserRole;
use App\Exceptions\ActionNotAllowedException;
use App\Exceptions\OwnerRequiredException;
use App\Models\User;
use App\Models\UserInvitation;
use App\Support\Actor;
use App\Support\Owners;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** PATCH /api/users/{id} {role}: owners only; the last active owner stays owner (owner rows locked, two owners at once cannot demote each other). */
final class ChangeUserRole
{
    /**
     * @param  array<string, mixed>  $input
     *
     * @throws OwnerRequiredException|ActionNotAllowedException|ValidationException
     */
    public function handle(Actor $actor, User $user, array $input): User
    {
        Owners::assertOwner($actor);
        $role = UserRole::from(Validator::make($input, ['role' => ['required', Rule::enum(UserRole::class)]])->validate()['role']);

        return DB::transaction(function () use ($user, $role): User {
            if ($role === UserRole::Member && Owners::lockActive() === [$user->id]) {
                throw ActionNotAllowedException::lastOwner();
            }
            if ($role === UserRole::Member && $user->role === UserRole::Owner) {
                // a former owner's open invitations would still let people in
                UserInvitation::query()->where('invited_by_id', $user->id)->whereNull('accepted_at')->delete();
            }
            $user->forceFill(['role' => $role])->save();

            return $user;
        });
    }
}
