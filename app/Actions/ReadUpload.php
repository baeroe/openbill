<?php

namespace App\Actions;

use App\Domain\Fields\ImagePath;
use App\Rendering\TemplatePackage;
use App\Support\Actor;
use App\Support\DownloadFile;
use Illuminate\Support\Facades\Storage;

/** GET /api/uploads/{name}: the stored image, null when the name is no upload or the file is gone. */
final class ReadUpload
{
    public function handle(Actor $actor, string $name): ?DownloadFile
    {
        $path = "uploads/{$name}";
        if (! ImagePath::isValid($path)) {
            return null;
        }
        $contents = Storage::disk('local')->get($path);

        return $contents === null ? null : new DownloadFile($name, TemplatePackage::mimeOf($path), $contents);
    }
}
