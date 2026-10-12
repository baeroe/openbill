<?php

namespace App\Rendering;

use App\Domain\Fields\ImagePath;
use Illuminate\Support\Facades\Storage;

/**
 * Chromium's header and footer can't load files, and a PDF must not depend on the network:
 * the organization logo and template assets become data URLs.
 */
final class AssetInliner
{
    /** Organization logo (path on the local disk) as data URL; '' when there is none. */
    public function logo(?string $path): string
    {
        if ($path === null || $path === '') {
            return '';
        }
        $disk = Storage::disk('local');
        $contents = $disk->get($path);
        if ($contents === null) {
            return '';
        }
        $mime = $disk->mimeType($path);

        return self::dataUrl(is_string($mime) ? $mime : 'application/octet-stream', $contents);
    }

    /** Value of an image field as data URL; '' for anything that is no stored upload. */
    public function upload(?string $path): string
    {
        if ($path === null || ! ImagePath::isValid($path)) {
            return '';
        }
        $contents = Storage::disk('local')->get($path);

        return $contents === null ? '' : self::dataUrl(TemplatePackage::mimeOf($path), $contents);
    }

    /**
     * Replaces references to template assets ("assets/logo.svg" or "./assets/logo.svg" in quotes or url())
     * by data URLs. Unknown assets stay as they are.
     *
     * @param  array<string, array{mime: string, contents: string}>  $assets  by package path
     */
    public function inline(string $html, array $assets): string
    {
        if ($assets === []) {
            return $html;
        }

        return (string) preg_replace_callback(
            '#(?<=["\'(])(?:\./)?(assets/[A-Za-z0-9._/-]+)(?=["\')])#',
            fn (array $m): string => isset($assets[$m[1]]) ? self::dataUrl($assets[$m[1]]['mime'], $assets[$m[1]]['contents']) : $m[0],
            $html,
        );
    }

    public static function dataUrl(string $mime, string $contents): string
    {
        return 'data:'.$mime.';base64,'.base64_encode($contents);
    }
}
