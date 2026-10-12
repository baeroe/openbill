<?php

namespace App\Mcp\Tools;

use App\ApiResource\FieldDefinitionResource;
use App\Mcp\Output;
use App\State\Provider\FieldDefinitionProvider;
use App\Support\Actor;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list-field-definitions')]
#[Title('List custom fields')]
#[Description('Custom fields: scope (org, customer, contact, document, position), key (used in "custom" and in templates), type, required, options of select fields and the document types a field applies to. Filter by scope and doc_type.')]
#[IsReadOnly]
#[IsOpenWorld(false)]
final class ListFieldDefinitionsTool extends OpenbillTool
{
    protected function run(Request $request, Actor $actor): Response
    {
        return Output::json(array_map(
            fn (FieldDefinitionResource $field): array => Output::resource($field),
            FieldDefinitionProvider::list($request->all(['scope', 'doc_type'])),
        ));
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'scope' => $schema->string()->enum(['org', 'customer', 'contact', 'document', 'position']),
            'doc_type' => $schema->string()->enum(['offer', 'confirmation', 'invoice', 'cancellation'])
                ->description('Only fields that apply to this document type (org, customer and contact fields always do)'),
        ];
    }
}
