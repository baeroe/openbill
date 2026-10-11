<?php

namespace App\State\Processor;

use ApiPlatform\Metadata\DeleteOperationInterface;
use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Actions\DeleteCustomer;
use App\Actions\SaveCustomer;
use App\ApiResource\CustomerResource;
use App\Models\Customer;
use App\State\ApiContext;

/** @implements ProcessorInterface<mixed, CustomerResource|null> */
final class CustomerProcessor implements ProcessorInterface
{
    public function __construct(
        private readonly SaveCustomer $save,
        private readonly DeleteCustomer $delete,
    ) {}

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): ?CustomerResource
    {
        $actor = ApiContext::actor($context);
        $customer = isset($uriVariables['id']) ? Customer::query()->findOrFail((string) $uriVariables['id']) : null;

        if ($operation instanceof DeleteOperationInterface && $customer !== null) {
            $this->delete->handle($actor, $customer);

            return null;
        }

        return CustomerResource::fromModel($this->save->handle($actor, ApiContext::body($context), $customer));
    }
}
