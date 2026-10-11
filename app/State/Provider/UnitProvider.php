<?php

namespace App\State\Provider;

use ApiPlatform\Metadata\CollectionOperationInterface;
use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\ApiResource\UnitResource;
use App\Models\Unit;
use App\State\ApiContext;

/** @implements ProviderInterface<UnitResource> */
final class UnitProvider implements ProviderInterface
{
    /**
     * @return UnitResource|list<UnitResource>
     */
    public function provide(Operation $operation, array $uriVariables = [], array $context = []): object|array
    {
        if ($operation instanceof CollectionOperationInterface) {
            $archived = ApiContext::request($context)->boolean('include_archived');

            return Unit::query()
                ->when(! $archived, fn ($query) => $query->whereNull('archived_at'))
                ->orderBy('sort')->orderBy('name')
                ->get()
                ->map(fn (Unit $unit): UnitResource => UnitResource::fromModel($unit))
                ->all();
        }

        return UnitResource::fromModel(Unit::query()->findOrFail((string) $uriVariables['id']));
    }
}
