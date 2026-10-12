<?php

namespace App\Actions;

use App\Models\User;
use App\Support\Actor;
use App\Support\Text;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * PUT /api/account/password (session only): the signed-in user changes their own password. The current password is
 * required; all other sessions end and the remember cookie is rotated (ResetPassword).
 */
final class ChangePassword
{
    public function __construct(private readonly ResetPassword $reset) {}

    /**
     * @param  array<string, mixed>  $input  current_password, password, password_confirmation
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, User $user, array $input, ?string $keepSessionId = null): User
    {
        $data = Validator::make($input, [
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:'.ResetPassword::MIN_LENGTH, 'max:255', 'confirmed'],
        ])->validate();

        if (! Hash::check((string) $data['current_password'], (string) $user->getAuthPassword())) {
            throw ValidationException::withMessages(['current_password' => [Text::t('account.current_password_wrong')]]);
        }

        return $this->reset->handle($actor, $user, (string) $data['password'], $keepSessionId);
    }
}
