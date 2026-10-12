<?php

namespace App\Actions;

use App\Models\User;
use App\Models\UserInvitation;
use App\Support\Actor;
use App\Support\InvitationLinks;
use App\Support\Owners;
use App\Support\UserRows;

/** GET /api/users: all users and the open invitations; only owners get the copyable links. */
final class ListUsers
{
    /**
     * @return array{users: list<array<string, mixed>>, invitations: list<array<string, mixed>>}
     */
    public function handle(Actor $actor, string $locale): array
    {
        $owner = Owners::isOwner($actor);

        return [
            'users' => User::query()->orderBy('name')->get()->map(fn (User $user): array => UserRows::user($user, $actor->userId))->values()->all(),
            'invitations' => UserInvitation::query()->whereNull('accepted_at')->where('expires_at', '>', now())->orderBy('created_at')->get()
                ->map(fn (UserInvitation $invitation): array => UserRows::invitation($invitation, $owner ? InvitationLinks::for($invitation, $locale) : null))
                ->values()->all(),
        ];
    }
}
