<?php

namespace App\Actions;

use App\Rendering\TemplatePackage;
use App\Support\Actor;
use App\Support\StoredImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * POST /api/uploads: an image for an image field, stored as uploads/<ulid>.<ext> on the local disk. The returned path
 * is the field value. Files are never deleted (finalized documents point at them through their snapshot).
 */
final class StoreUpload
{
    /**
     * @return array{path: string, mime: string, size: int}
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, UploadedFile $file): array
    {
        [$extension, $contents] = StoredImage::validate($file, 'file');
        $path = 'uploads/'.strtolower((string) Str::ulid()).'.'.$extension;
        Storage::disk('local')->put($path, $contents);

        return ['path' => $path, 'mime' => TemplatePackage::mimeOf($path), 'size' => strlen($contents)];
    }
}
