<?php

namespace App\Mcp\Tools;

use App\Actions\SaveCustomer;
use App\ApiResource\CustomerResource;
use App\Mcp\Output;
use App\Mcp\Schemas;
use App\Models\Customer;
use App\Support\Actor;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Arr;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[Name('update-customer')]
#[Description('Change a customer. Only the keys you send change. "contacts", when sent, is the complete list: send the id of a contact to keep it, contacts left out are removed. Finalized documents keep the data they were finalized with.')]
#[IsDestructive]
#[IsIdempotent]
final class UpdateCustomerTool extends OpenbillTool
{
    public function __construct(private readonly SaveCustomer $save) {}

    protected function run(Request $request, Actor $actor): Response
    {
        $customer = self::find($request, Customer::class, 'customer');

        return Output::json(Output::resource(CustomerResource::fromModel($this->save->handle($actor, Arr::except($request->all(), ['id']), $customer))));
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()->required()->description('Customer ID (ULID)'),
            ...Schemas::customer($schema, create: false),
        ];
    }
}
