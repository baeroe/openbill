<?php

namespace App\Mcp\Tools;

use App\Actions\SaveFieldDefinition;
use App\ApiResource\FieldDefinitionResource;
use App\Mcp\Output;
use App\Mcp\Schemas;
use App\Models\FieldDefinition;
use App\Support\Actor;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Arr;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[Name('save-field-definition')]
#[Description('Create a custom field (without id: scope, label and type are required) or change one (with id: only the keys you send change; scope and key stay). Templates read the value as e.g. document.po_number, drafts and customers keep it in "custom".')]
#[IsDestructive]
final class SaveFieldDefinitionTool extends OpenbillTool
{
    public function __construct(private readonly SaveFieldDefinition $save) {}

    protected function run(Request $request, Actor $actor): Response
    {
        $field = $request->get('id') !== null ? self::find($request, FieldDefinition::class, 'field') : null;

        return Output::json(Output::resource(FieldDefinitionResource::fromModel($this->save->handle($actor, Arr::except($request->all(), ['id']), $field))));
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()->description('Field ID to change an existing field; left out: a new field'),
            ...Schemas::fieldDefinition($schema),
        ];
    }
}
