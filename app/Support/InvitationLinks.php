<?php

namespace App\Support;

use App\Models\UserInvitation;
use Illuminate\Support\Facades\URL;

/**
 * Copyable invitation link: signed (relative, like SignedDownloads), without expiry in the signature – the invitation
 * itself expires, so an old link shows "expired" instead of a bare 403.
 */
final class InvitationLinks
{
    public static function for(UserInvitation $invitation, string $locale): string
    {
        return url(URL::signedRoute('invitations.show', ['locale' => $locale, 'invitation' => $invitation->id], absolute: false));
    }

    /** @return 'open'|'expired'|'closed' */
    public static function state(?UserInvitation $invitation): string
    {
        return match (true) {
            $invitation === null || $invitation->accepted_at !== null => 'closed',
            $invitation->expires_at->isPast() => 'expired',
            default => 'open',
        };
    }
}
