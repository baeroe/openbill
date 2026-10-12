<?php

namespace App\Support;

use App\Rendering\TemplatePackage;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

/** Images people upload (logo, image fields): type, size and content check, and how they are served. */
final class StoredImage
{
    /** @var list<string> */
    public const EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];

    public const MAX_BYTES = 1024 * 1024;

    /**
     * @return array{0: string, 1: string} extension (lower case) and contents
     *
     * @throws ValidationException under $attribute
     */
    public static function validate(UploadedFile $file, string $attribute): array
    {
        $extension = strtolower($file->getClientOriginalExtension());
        $fail = fn (string $key, array $replace = []): ValidationException => ValidationException::withMessages([$attribute => [Text::t($key, $replace)]]);

        if (! in_array($extension, self::EXTENSIONS, true)) {
            throw $fail('uploads.type', ['types' => 'PNG, JPEG, GIF, WebP, SVG']);
        }
        if ((int) $file->getSize() > self::MAX_BYTES) {
            throw $fail('uploads.too_large', ['mb' => 1]);
        }
        $contents = (string) $file->get();
        // same content check as template assets: the bytes must be what the extension says
        $problem = TemplatePackage::assetProblem("assets/image.{$extension}", $contents);
        if ($problem !== null) {
            throw $fail('uploads.content');
        }

        return [$extension, $contents];
    }

    /**
     * Headers for serving an uploaded file: an SVG opened directly must not run scripts or load anything.
     *
     * @return array<string, string>
     */
    public static function headers(): array
    {
        return [
            'Content-Security-Policy' => "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, max-age=0, must-revalidate',
        ];
    }
}
