<?php

namespace App\Actions;

use App\Models\User;
use App\Models\UserInvitation;
use App\Support\Actor;
use App\Support\InvitationLinks;
use App\Support\Text;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/** The invited person sets name and password: a new account with the invited role; the invitation is used up. */
final class AcceptInvitation
{
    /**
     * @param  array<string, mixed>  $input  name, password, password_confirmation
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, UserInvitation $invitation, array $input): User
    {
        $data = Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'min:8', 'max:255', 'confirmed'],
        ])->validate();

        return DB::transaction(function () use ($invitation, $data): User {
            $invitation = UserInvitation::query()->lockForUpdate()->findOrFail($invitation->id);
            if ($invitation->accepted_at !== null || $invitation->expires_at->isPast() || ! InvitationLinks::inviterActive($invitation)) {
                throw ValidationException::withMessages(['invitation' => [Text::t('invitations.closed')]]);
            }
            if (User::query()->where('email', $invitation->email)->exists()) {
                throw ValidationException::withMessages(['email' => [Text::t('invitations.email_taken')]]);
            }

            $user = User::query()->create([
                'name' => trim((string) $data['name']),
                'email' => $invitation->email,
                'password' => $data['password'],
                'role' => $invitation->role,
                'locale' => app()->getLocale(),
            ]);
            $invitation->forceFill(['accepted_at' => now()])->save();

            return $user;
        });
    }
}
