<?php

namespace App\State\Processor;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Actions\UpdateCustomerNumbering;
use App\ApiResource\CustomerNumberingResource;
use App\State\ApiContext;
use App\State\Provider\CustomerNumberingProvider;

/** @implements ProcessorInterface<mixed, CustomerNumberingResource> */
final class CustomerNumberingProcessor implements ProcessorInterface
{
    public function __construct(private readonly UpdateCustomerNumbering $update) {}

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): CustomerNumberingResource
    {
        $this->update->handle(ApiContext::actor($context), ApiContext::body($context));

        return CustomerNumberingProvider::resource();
    }
}
