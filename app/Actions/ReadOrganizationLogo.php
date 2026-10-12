<?php

namespace App\Actions;

use App\Models\Organization;
use App\Rendering\TemplatePackage;
use App\Support\Actor;
use App\Support\DownloadFile;
use Illuminate\Support\Facades\Storage;

/** GET /api/organization/logo: the current logo, null without one. */
final class ReadOrganizationLogo
{
    public function handle(Actor $actor): ?DownloadFile
    {
        $path = Organization::current()->logo_path;
        if ($path === null || $path === '') {
            return null;
        }
        $contents = Storage::disk('local')->get($path);

        return $contents === null ? null : new DownloadFile(basename($path), TemplatePackage::mimeOf($path), $contents);
    }
}
