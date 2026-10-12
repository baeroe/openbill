<?php

namespace App\Actions;

use App\Models\Template;
use App\Models\TemplateAsset;
use App\Support\Actor;
use App\Support\Text;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * POST /api/templates/{id}/duplicate: an editable copy of any template (built-in ones are changed this way).
 * Name "<name> (copy)" in the request language (manifest limit 100 characters), a free slug like the import,
 * assets copied into the folder of the copy.
 */
final class DuplicateTemplate
{
    public function handle(Actor $actor, Template $template): Template
    {
        $template->loadMissing('assets');

        return DB::transaction(function () use ($template): Template {
            $name = Str::limit(Text::t('templates.copy_name', ['name' => $template->name]), 100, '');
            $copy = Template::query()->create([
                'name' => $name,
                'slug' => ImportTemplatePackage::freeSlug(Str::slug($name) ?: 'template'),
                'version' => $template->version,
                'author' => $template->author,
                'license' => $template->license,
                'description' => $template->description,
                'built_in' => false,
                'manifest' => [...($template->manifest ?? []), 'name' => $name],
                'header' => $template->header,
                'body' => $template->body,
                'footer' => $template->footer,
                'css' => $template->css,
            ]);

            $disk = Storage::disk('local');
            $folder = "templates/{$copy->id}";
            DB::afterRollBack(fn () => $disk->deleteDirectory($folder));
            foreach ($template->assets as $asset) {
                /** @var TemplateAsset $asset */
                $contents = $disk->get($asset->storage_path);
                if ($contents === null) {
                    continue;
                }
                $disk->put("{$folder}/{$asset->path}", $contents);
                $copy->assets()->create([
                    'path' => $asset->path,
                    'mime' => $asset->mime,
                    'storage_path' => "{$folder}/{$asset->path}",
                    'size' => strlen($contents),
                ]);
            }

            return $copy->load('assets');
        });
    }
}
