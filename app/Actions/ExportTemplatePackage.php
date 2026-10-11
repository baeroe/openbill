<?php

namespace App\Actions;

use App\Models\Template;
use App\Rendering\TemplatePackage;
use App\Support\Actor;
use App\Support\DownloadFile;

/** Template → package ZIP (GET /api/templates/{id}/package in phase 4, export in the template editor in phase 7). */
final class ExportTemplatePackage
{
    public function handle(Actor $actor, Template $template): DownloadFile
    {
        return new DownloadFile(
            "{$template->slug}-{$template->version}.zip",
            'application/zip',
            TemplatePackage::fromTemplate($template->loadMissing('assets'))->toZip(),
        );
    }
}
