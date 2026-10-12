<?php

namespace App\Actions;

use App\Models\Template;
use App\Rendering\TemplatePackage;
use App\Support\Actor;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** Template package (ZIP) → new, editable template. Assets go to the local disk under templates/<id>/. */
final class ImportTemplatePackage
{
    /**
     * @throws ValidationException
     */
    public function handle(Actor $actor, string $zipPath): Template
    {
        $package = TemplatePackage::fromZip($zipPath);

        return DB::transaction(function () use ($package): Template {
            $manifest = $package->manifest;
            $template = Template::query()->create([
                'name' => $manifest['name'],
                'slug' => self::freeSlug(Str::slug((string) $manifest['name']) ?: 'template'),
                'version' => $manifest['version'],
                'author' => (string) ($manifest['author'] ?? ''),
                'license' => (string) ($manifest['license'] ?? ''),
                'description' => $manifest['description'] ?? null,
                'built_in' => false,
                'manifest' => $manifest,
                'header' => $package->header,
                'body' => $package->body,
                'footer' => $package->footer,
                'css' => $package->css,
            ]);
            $folder = "templates/{$template->id}";
            DB::afterRollBack(fn () => Storage::disk('local')->deleteDirectory($folder));

            foreach ($package->assets as $path => $contents) {
                Storage::disk('local')->put("{$folder}/{$path}", $contents);
                $template->assets()->create([
                    'path' => $path,
                    'mime' => TemplatePackage::mimeOf($path),
                    'storage_path' => "{$folder}/{$path}",
                    'size' => strlen($contents),
                ]);
            }

            return $template->load('assets');
        });
    }

    /** Built-in slugs stay reserved, so syncing them never overwrites an imported template. */
    public static function freeSlug(string $base): string
    {
        $slug = $base;
        for ($n = 2; in_array($slug, SyncBuiltInTemplates::SLUGS, true) || Template::query()->where('slug', $slug)->exists(); $n++) {
            $slug = "{$base}-{$n}";
        }

        return $slug;
    }
}
