<?php

namespace App\Mcp\Tools;

use App\ApiResource\DocumentResource;
use App\Mcp\Output;
use App\Models\Document;
use App\State\Provider\DocumentProvider;
use App\Support\Actor;
use App\Support\DocumentInspector;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('get-document')]
#[Description('One document completely: fields, custom values, groups with positions (the shape update-document takes), totals and – for drafts – the "issues" that block finalize-document (an empty list means ready).')]
#[IsReadOnly]
final class GetDocumentTool extends OpenbillTool
{
    public function __construct(private readonly DocumentInspector $inspector) {}

    protected function run(Request $request, Actor $actor): Response
    {
        $document = self::find($request, Document::class, 'document');

        return Output::json(Output::resource(DocumentResource::fromModel(DocumentProvider::load($document->id), $this->inspector)));
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return ['id' => $schema->string()->required()->description('Document ID (ULID)')];
    }
}
