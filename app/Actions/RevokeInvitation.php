<?php

namespace App\Actions;

use App\Exceptions\OwnerRequiredException;
use App\Models\UserInvitation;
use App\Support\Actor;
use App\Support\Owners;

/** DELETE /api/invitations/{id}: the link stops working at once. */
final class RevokeInvitation
{
    /**
     * @throws OwnerRequiredException
     */
    public function handle(Actor $actor, UserInvitation $invitation): void
    {
        Owners::assertOwner($actor);
        $invitation->delete();
    }
}
