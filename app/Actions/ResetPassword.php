<?php

namespace App\Actions;

use App\Models\User;
use App\Support\Actor;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Sets a new password (php artisan app:reset-password, and ChangePassword for the signed-in user): at least 8
 * characters; every session of the account ends (except $keepSessionId) and the remember cookie stops working.
 * API tokens stay valid – they are separate credentials, revoked in "API & MCP".
 */
final class ResetPassword
{
    public const MIN_LENGTH = 8;

    /**
     * @throws ValidationException
     */
    public function handle(Actor $actor, User $user, string $password, ?string $keepSessionId = null): User
    {
        Validator::make(['password' => $password], ['password' => ['required', 'string', 'min:'.self::MIN_LENGTH, 'max:255']])->validate();

        return DB::transaction(function () use ($user, $password, $keepSessionId): User {
            $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
            DB::table('sessions')
                ->where('user_id', $user->id)
                ->when($keepSessionId !== null, fn ($sessions) => $sessions->where('id', '!=', $keepSessionId))
                ->delete();

            return $user;
        });
    }
}
