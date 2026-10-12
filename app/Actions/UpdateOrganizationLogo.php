<?php

namespace App\Actions;

use App\Models\Organization;
use App\Support\Actor;
use App\Support\StoredImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * POST /api/organization/logo: a new logo file (logos/<ulid>.<ext>). The previous file stays: snapshots of finalized
 * documents keep pointing at it (app:prune-images removes it once nothing does).
 */
final class UpdateOrganizationLogo
{
    /**
     * @throws ValidationException under "logo"
     */
    public function handle(Actor $actor, UploadedFile $file): Organization
    {
        [$extension, $contents] = StoredImage::validate($file, 'logo');
        $path = 'logos/'.strtolower((string) Str::ulid()).'.'.$extension;
        Storage::disk('local')->put($path, $contents);

        $org = Organization::current();
        $org->forceFill(['logo_path' => $path])->save();

        return $org;
    }
}
