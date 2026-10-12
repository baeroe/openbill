<?php

namespace App\Mcp\Tools;

use App\ApiResource\CustomerResource;
use App\Mcp\Output;
use App\Models\Customer;
use App\Support\Actor;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('get-customer')]
#[Title('Get customer')]
#[Description('One customer with address, tax treatment, custom fields and contacts (their ids keep them in update-customer).')]
#[IsReadOnly]
#[IsOpenWorld(false)]
final class GetCustomerTool extends OpenbillTool
{
    protected function run(Request $request, Actor $actor): Response
    {
        return Output::json(Output::resource(CustomerResource::fromModel(self::find($request, Customer::class, 'customer'))));
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return ['id' => $schema->string()->required()->description('Customer ID (ULID)')];
    }
}
