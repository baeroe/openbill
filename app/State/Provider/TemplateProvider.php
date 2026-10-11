<?php

namespace App\State\Provider;

use ApiPlatform\Metadata\CollectionOperationInterface;
use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\ApiResource\TemplateResource;
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
            return Template::query()->with('assets')->orderByDesc('built_in')->orderBy('name')->get()
                ->map(fn (Template $template): TemplateResource => TemplateResource::fromModel($template))
                ->all();
        }

        return TemplateResource::fromModel(Template::query()->with('assets')->findOrFail((string) $uriVariables['id']));
    }
}
