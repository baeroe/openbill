<?php

namespace App\State\Provider;

use ApiPlatform\Laravel\Eloquent\Paginator;
use ApiPlatform\Metadata\CollectionOperationInterface;
use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\ApiResource\CustomerResource;
use App\Models\Customer;
use App\State\ApiContext;
use App\State\Paginate;
use App\Support\Like;

/** @implements ProviderInterface<CustomerResource> */
final class CustomerProvider implements ProviderInterface
{
    /**
     * @return CustomerResource|Paginator<CustomerResource>
     */
    public function provide(Operation $operation, array $uriVariables = [], array $context = []): object
    {
        if (! $operation instanceof CollectionOperationInterface) {
            return CustomerResource::fromModel(Customer::query()->with('contacts')->findOrFail((string) $uriVariables['id']));
        }

        $request = ApiContext::request($context);
        $q = trim((string) $request->query('q', ''));
        $query = Customer::query()
            ->with('contacts')
            ->when($q !== '', fn ($query) => $query->where(fn ($where) => $where
                ->where('name', 'like', Like::contains($q))
                ->orWhere('number', 'like', Like::contains($q))
                ->orWhere('email', 'like', Like::contains($q))))
            ->orderBy('name')->orderBy('id');

        return Paginate::query($query, $request, fn (Customer $customer): CustomerResource => CustomerResource::fromModel($customer));
    }
}
