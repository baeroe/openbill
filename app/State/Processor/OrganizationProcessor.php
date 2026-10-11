<?php

namespace App\State\Processor;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Actions\UpdateOrganization;
use App\ApiResource\OrganizationResource;
use App\State\ApiContext;

/** @implements ProcessorInterface<mixed, OrganizationResource> */
final class OrganizationProcessor implements ProcessorInterface
{
    public function __construct(private readonly UpdateOrganization $update) {}

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): OrganizationResource
    {
        return OrganizationResource::fromModel($this->update->handle(ApiContext::actor($context), ApiContext::body($context)));
    }
}
