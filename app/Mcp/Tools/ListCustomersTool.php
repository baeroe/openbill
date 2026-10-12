<?php

namespace App\Mcp\Tools;

use App\ApiResource\CustomerResource;
use App\Mcp\Output;
use App\Mcp\Schemas;
use App\Models\Customer;
use App\State\Provider\CustomerProvider;
use App\Support\Actor;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list-customers')]
#[Description('Customers with their contacts, sorted by name. "q" searches name, number and email. Paged with page and per_page (up to 100); the answer has items, total and has_more.')]
#[IsReadOnly]
final class ListCustomersTool extends OpenbillTool
{
    protected function run(Request $request, Actor $actor): Response
    {
        [$page, $perPage] = self::paging($request);
        $data = $request->validate(['q' => ['sometimes', 'nullable', 'string', 'max:100']]);
        $customers = CustomerProvider::search(trim((string) ($data['q'] ?? '')))->paginate(perPage: $perPage, page: $page);

        return Output::json(Output::page($customers, fn (Customer $customer): array => Output::resource(CustomerResource::fromModel($customer))));
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'q' => $schema->string()->description('Search in name, number and email'),
            ...Schemas::paging($schema),
        ];
    }
}
