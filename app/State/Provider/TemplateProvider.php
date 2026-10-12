<?php

namespace App\State\Provider;

use ApiPlatform\Metadata\CollectionOperationInterface;
use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\ApiResource\TemplateResource;
use App\Models\DocumentTypeSetting;
use App\Models\Template;

/** @implements ProviderInterface<TemplateResource> */
final class TemplateProvider implements ProviderInterface
{
    /**
     * @return TemplateResource|list<TemplateResource>
     */
    public function provide(Operation $operation, array $uriVariables = [], array $context = []): object|array
    {
        if ($operation instanceof CollectionOperationInterface) {
            // templates in use as a default first (a type without one falls back to Klar), then built-ins, then by name
            $defaults = DocumentTypeSetting::query()->pluck('template_id');
            $inUse = $defaults->filter()->values()->all();
            $fallback = $defaults->contains(null);

            return Template::query()->with('assets')->orderByDesc('built_in')->orderBy('name')->get()
                ->sortBy(fn (Template $template): int => in_array($template->id, $inUse, true) || ($fallback && $template->slug === 'klar') ? 0 : 1)
                ->values()
                ->map(fn (Template $template): TemplateResource => TemplateResource::fromModel($template))
                ->all();
        }

        return TemplateResource::fromModel(Template::query()->with('assets')->findOrFail((string) $uriVariables['id']));
    }
}
