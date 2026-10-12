<?php

namespace App\Actions;

use App\Models\Organization;
use App\Support\Actor;

/** DELETE /api/organization/logo: templates show the company name again; the file stays for snapshots. */
final class RemoveOrganizationLogo
{
    public function handle(Actor $actor): Organization
    {
        $org = Organization::current();
        $org->forceFill(['logo_path' => null])->save();

        return $org;
    }
}
