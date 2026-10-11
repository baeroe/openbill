<?php

namespace App\State\Provider;

use ApiPlatform\Metadata\CollectionOperationInterface;
use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\ApiResource\TaxRateResource;
use App\Models\TaxRate;
use App\State\ApiContext;

/** @implements ProviderInterface<TaxRateResource> */
final class TaxRateProvider implements ProviderInterface
{
    /**
     * @return TaxRateResource|list<TaxRateResource>
     */
    public function provide(Operation $operation, array $uriVariables = [], array $context = []): object|array
    {
        if ($operation instanceof CollectionOperationInterface) {
            $archived = ApiContext::request($context)->boolean('include_archived');

            return TaxRate::query()
                ->when(! $archived, fn ($query) => $query->whereNull('archived_at'))
                ->orderBy('sort')->orderBy('label')
                ->get()
                ->map(fn (TaxRate $rate): TaxRateResource => TaxRateResource::fromModel($rate))
                ->all();
        }

        return TaxRateResource::fromModel(TaxRate::query()->findOrFail((string) $uriVariables['id']));
    }
}
