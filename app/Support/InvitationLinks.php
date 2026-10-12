<?php

namespace App\Support;

use App\Enums\UserRole;
use App\Models\User;
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

    /** Only an active owner's invitation lets someone in (disabling or demoting revokes them, this guards the rest). */
    public static function inviterActive(UserInvitation $invitation): bool
    {
        return $invitation->invited_by_id !== null
            && User::query()->whereKey($invitation->invited_by_id)->where('role', UserRole::Owner)->whereNull('disabled_at')->exists();
    }

    /** @return 'open'|'expired'|'closed' */
    public static function state(?UserInvitation $invitation): string
    {
        return match (true) {
            $invitation === null || $invitation->accepted_at !== null || ! self::inviterActive($invitation) => 'closed',
            $invitation->expires_at->isPast() => 'expired',
            default => 'open',
        };
    }
}
