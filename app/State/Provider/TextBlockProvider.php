<?php

namespace App\State\Provider;

use ApiPlatform\Metadata\CollectionOperationInterface;
use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\ApiResource\TextBlockResource;
use App\Models\TextBlock;
use App\State\ApiContext;

/** @implements ProviderInterface<TextBlockResource> */
final class TextBlockProvider implements ProviderInterface
{
    /**
     * @return TextBlockResource|list<TextBlockResource>
     */
    public function provide(Operation $operation, array $uriVariables = [], array $context = []): object|array
    {
        if ($operation instanceof CollectionOperationInterface) {
            $kind = ApiContext::request($context)->query('kind');

            return TextBlock::query()
                ->when(is_string($kind) && $kind !== '', fn ($query) => $query->where('kind', $kind))
                ->orderBy('kind')->orderBy('name')
                ->get()
                ->map(fn (TextBlock $block): TextBlockResource => TextBlockResource::fromModel($block))
                ->all();
        }

        return TextBlockResource::fromModel(TextBlock::query()->findOrFail((string) $uriVariables['id']));
    }
}
