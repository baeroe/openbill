<?php

namespace App\Support;

use App\Models\User;
use App\Models\UserInvitation;

/** JSON rows of the users settings (GET /api/users and the answers of the user actions). */
final class UserRows
{
    /** @return array{id: string, name: string, email: string, role: string, is_self: bool, disabled_at: string|null} */
    public static function user(User $user, ?string $viewerId): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->value,
            'is_self' => $user->id === $viewerId,
            'disabled_at' => $user->disabled_at?->toAtomString(),
        ];
    }

    /** @return array{id: string, email: string, role: string, expires_at: string, link: string|null} */
    public static function invitation(UserInvitation $invitation, ?string $link): array
    {
        return ['id' => $invitation->id, 'email' => $invitation->email, 'role' => $invitation->role->value, 'expires_at' => $invitation->expires_at->toAtomString(), 'link' => $link];
    }
}
