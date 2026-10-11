<?php

namespace App\State\Provider;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\ApiResource\OrganizationResource;
use App\Models\Organization;

/** @implements ProviderInterface<OrganizationResource> */
final class OrganizationProvider implements ProviderInterface
{
    public function provide(Operation $operation, array $uriVariables = [], array $context = []): OrganizationResource
    {
        return OrganizationResource::fromModel(Organization::current());
    }
}
