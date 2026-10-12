<?php

namespace App\Actions;

use App\Enums\UserRole;
use App\Exceptions\OwnerRequiredException;
use App\Models\UserInvitation;
use App\Support\Actor;
use App\Support\Owners;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** POST /api/invitations: owner invites {email, role}; valid 7 days; replaces an open invitation to the same address. */
final class InviteUser
{
    public const DAYS = 7;

    /**
     * @param  array<string, mixed>  $input
     *
     * @throws OwnerRequiredException|ValidationException
     */
    public function handle(Actor $actor, array $input): UserInvitation
    {
        $owner = Owners::assertOwner($actor);
        $input['email'] = is_string($input['email'] ?? null) ? trim($input['email']) : ($input['email'] ?? null);
        $data = Validator::make($input, [
            // the collation compares case-insensitively, so Anna@… and anna@… are the same account
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')],
            'role' => ['required', Rule::enum(UserRole::class)],
        ])->validate();

        return DB::transaction(function () use ($data, $owner): UserInvitation {
            UserInvitation::query()->where('email', $data['email'])->whereNull('accepted_at')->delete();

            return UserInvitation::query()->create([
                'email' => $data['email'],
                'role' => UserRole::from($data['role']),
                'invited_by_id' => $owner->id,
                'expires_at' => now()->addDays(self::DAYS),
            ]);
        });
    }
}
