<?php

namespace App\Mcp\Tools;

use App\Actions\SaveCustomer;
use App\ApiResource\CustomerResource;
use App\Mcp\Output;
use App\Mcp\Schemas;
use App\Support\Actor;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[Name('create-customer')]
#[Description('Create a customer. Only "name" is required; the number is assigned when left out. "contacts" lists the contact persons, exactly one becomes the default. Custom fields go into "custom" (keys from list-field-definitions). eu_reverse_charge needs a business customer with a VAT ID.')]
#[IsDestructive(false)]
final class CreateCustomerTool extends OpenbillTool
{
    public function __construct(private readonly SaveCustomer $save) {}

    protected function run(Request $request, Actor $actor): Response
    {
        return Output::json(Output::resource(CustomerResource::fromModel($this->save->handle($actor, $request->all()))));
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return Schemas::customer($schema, create: true);
    }
}
