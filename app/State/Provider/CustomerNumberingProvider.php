<?php

namespace App\State\Provider;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\ApiResource\CustomerNumberingResource;
use App\Support\NumberRange;
use Carbon\CarbonImmutable;

/** @implements ProviderInterface<CustomerNumberingResource> */
final class CustomerNumberingProvider implements ProviderInterface
{
    public function provide(Operation $operation, array $uriVariables = [], array $context = []): CustomerNumberingResource
    {
        return self::resource();
    }

    public static function resource(): CustomerNumberingResource
    {
        return CustomerNumberingResource::fromArray(NumberRange::customer()->describe(CarbonImmutable::now()));
    }
}
