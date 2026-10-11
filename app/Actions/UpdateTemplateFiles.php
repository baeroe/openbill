<?php

namespace App\Actions;

use App\Exceptions\ActionNotAllowedException;
use App\Models\Template;
use App\Rendering\ManifestValidator;
use App\Rendering\TemplatePackage;
use App\Support\Actor;
use App\Support\Text;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * PUT /api/templates/{id}/files (toolkit "pnpm push", template editor): replaces the given parts of an
 * imported template. header, body, footer, css: strings (file names: TemplatePackage::FILES);
 * manifest: object, also sets name, version, author, license, description; assets: the complete list
 * {"assets/<file>": "<base64>"}. Built-in templates are read-only.
 */
final class UpdateTemplateFiles
{
    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException|ActionNotAllowedException
     */
    public function handle(Actor $actor, Template $template, array $input): Template
    {
        if ($template->built_in) {
            throw ActionNotAllowedException::templateBuiltIn();
        }

        $text = ['sometimes', 'nullable', 'string', 'max:'.(int) config('openbill.rendering.max_source_bytes')];
        $data = Validator::make($input, [
            'header' => $text,
            'body' => $text,
            'footer' => $text,
            'css' => $text,
            'manifest' => ['sometimes', 'array'],
            'assets' => ['sometimes', 'array', 'max:'.(int) config('openbill.templates.max_entries')],
        ])->validate();

        $errors = [];
        if (array_key_exists('manifest', $data)) {
            foreach (ManifestValidator::validate($data['manifest']) as $path => $message) {
                $errors[$path === 'manifest' ? 'manifest' : "manifest.{$path}"][] = $message;
            }
        }
        $assets = array_key_exists('assets', $data) ? $this->decodeAssets($data['assets'], $errors) : null;
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return DB::transaction(function () use ($template, $data, $assets): Template {
            foreach (array_keys(TemplatePackage::FILES) as $column) {
                if (array_key_exists($column, $data)) {
                    $template->{$column} = (string) ($data[$column] ?? '');
                }
            }
            if (array_key_exists('manifest', $data)) {
                $manifest = $data['manifest'];
                $template->forceFill([
                    'manifest' => $manifest,
                    'name' => $manifest['name'],
                    'version' => $manifest['version'],
                    'author' => (string) ($manifest['author'] ?? ''),
                    'license' => (string) ($manifest['license'] ?? ''),
                    'description' => $manifest['description'] ?? null,
                ]);
            }
            $template->save();

            if ($assets !== null) {
                $this->replaceAssets($template, $assets);
            }

            return $template->load('assets');
        });
    }

    /**
     * @param  array<array-key, mixed>  $encoded
     * @param  array<string, list<string>>  $errors
     * @return array<string, string> path => contents
     */
    private function decodeAssets(array $encoded, array &$errors): array
    {
        // sizes from the base64 length first: nothing is decoded when the total or one asset is too large
        $maxTotal = (int) config('openbill.templates.max_unpacked_bytes');
        $maxAsset = (int) config('openbill.templates.max_asset_bytes');
        $estimated = 0;
        $tooLarge = false;
        foreach ($encoded as $path => $value) {
            $bytes = is_string($value) ? intdiv(strlen($value) * 3, 4) : 0;
            $estimated += $bytes;
            if ($bytes > $maxAsset) {
                $tooLarge = true;
                $errors["assets.{$path}"][] = Text::t('template_package.asset_too_large', ['path' => (string) $path, 'mb' => intdiv($maxAsset, 1024 * 1024)]);
            }
        }
        if ($estimated > $maxTotal) {
            $tooLarge = true;
            $errors['assets'][] = Text::t('template_package.too_large', ['mb' => intdiv($maxTotal, 1024 * 1024)]);
        }
        if ($tooLarge) {
            return [];
        }

        $assets = [];
        $total = 0;
        foreach ($encoded as $path => $value) {
            $path = (string) $path;
            $contents = is_string($value) ? base64_decode($value, true) : false;
            if ($contents === false) {
                $errors["assets.{$path}"][] = Text::t('template_package.asset_base64', ['path' => $path]);

                continue;
            }
            $problem = TemplatePackage::assetProblem($path, $contents);
            if ($problem !== null) {
                $errors["assets.{$path}"][] = Text::t($problem[0], $problem[1]);

                continue;
            }
            $total += strlen($contents);
            $assets[$path] = $contents;
        }
        $max = (int) config('openbill.templates.max_unpacked_bytes');
        if ($total > $max) {
            $errors['assets'][] = Text::t('template_package.too_large', ['mb' => intdiv($max, 1024 * 1024)]);
        }

        return $assets;
    }

    /**
     * New files go to a fresh folder; the old ones are deleted after the commit, the new ones after a rollback.
     *
     * @param  array<string, string>  $assets
     */
    private function replaceAssets(Template $template, array $assets): void
    {
        $disk = Storage::disk('local');
        $old = $template->assets()->pluck('storage_path')->all();
        $folder = "templates/{$template->id}/".strtolower((string) Str::ulid());
        DB::afterRollBack(fn () => $disk->deleteDirectory($folder));

        $template->assets()->delete();
        foreach ($assets as $path => $contents) {
            $disk->put("{$folder}/{$path}", $contents);
            $template->assets()->create([
                'path' => $path,
                'mime' => TemplatePackage::mimeOf($path),
                'storage_path' => "{$folder}/{$path}",
                'size' => strlen($contents),
            ]);
        }

        DB::afterCommit(fn () => $disk->delete($old));
    }
}
