<?php

namespace App\Actions;

use App\Models\DocumentTypeSetting;
use App\Models\Template;
use App\Rendering\TemplatePackage;
use App\Support\Actor;
use Illuminate\Support\Facades\DB;

/**
 * Creates or updates the built-in templates from resources/templates/<slug>/ (idempotent).
 * Runs in the migration 2026_10_11_100400, in DemoSeeder and – via app:sync-templates – in the
 * Docker entrypoint, so an update of openbill also updates the built-ins. Document types without
 * a template get "klar".
 */
final class SyncBuiltInTemplates
{
    public const SLUGS = ['klar', 'kante', 'leise'];

    /**
     * @return array<string, Template> by slug
     */
    public function handle(Actor $actor): array
    {
        return DB::transaction(function (): array {
            $templates = [];
            foreach (self::SLUGS as $slug) {
                $package = TemplatePackage::fromDirectory(resource_path("templates/{$slug}"));
                $templates[$slug] = Template::query()->updateOrCreate(['slug' => $slug], [
                    'name' => $package->manifest['name'],
                    'version' => $package->manifest['version'],
                    'author' => $package->manifest['author'] ?? 'openbill',
                    'license' => $package->manifest['license'] ?? 'MIT',
                    'description' => $package->manifest['description'] ?? null,
                    'built_in' => true,
                    'manifest' => $package->manifest,
                    'header' => $package->header,
                    'body' => $package->body,
                    'footer' => $package->footer,
                    'css' => $package->css,
                ]);
            }
            DocumentTypeSetting::query()->whereNull('template_id')->update(['template_id' => $templates['klar']->id]);

            return $templates;
        });
    }
}
