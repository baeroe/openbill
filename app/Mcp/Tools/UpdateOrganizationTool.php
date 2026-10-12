<?php

namespace App\Mcp\Tools;

use App\Actions\UpdateOrganization;
use App\ApiResource\OrganizationResource;
use App\Mcp\Output;
use App\Mcp\Schemas;
use App\Support\Actor;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;

#[Name('update-organization')]
#[Title('Update organization')]
#[Description('Change the organization (the sender on every document). Only the keys you send change. Finalized documents keep the data they were finalized with. The logo is set in the openbill settings, not here.')]
#[IsDestructive]
#[IsIdempotent]
#[IsOpenWorld(false)]
final class UpdateOrganizationTool extends OpenbillTool
{
    public function __construct(private readonly UpdateOrganization $update) {}

    protected function run(Request $request, Actor $actor): Response
    {
        return Output::json(Output::resource(OrganizationResource::fromModel($this->update->handle($actor, $request->all()))));
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return Schemas::organization($schema);
    }
}
