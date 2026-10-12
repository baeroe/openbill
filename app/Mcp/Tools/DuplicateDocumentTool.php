<?php

namespace App\Mcp\Tools;

use App\Actions\DuplicateDocument;
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
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[Name('duplicate-document')]
#[Description('Copy a document (draft or finalized, not a cancellation) into a new draft of the same type with today\'s date. The source stays unchanged. Answers with the new draft.')]
#[IsDestructive(false)]
final class DuplicateDocumentTool extends OpenbillTool
{
    public function __construct(
        private readonly DuplicateDocument $duplicate,
        private readonly DocumentInspector $inspector,
    ) {}

    protected function run(Request $request, Actor $actor): Response
    {
        $copy = $this->duplicate->handle($actor, self::find($request, Document::class, 'document'));

        return Output::json(Output::resource(DocumentResource::fromModel(DocumentProvider::load($copy->id), $this->inspector)));
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return ['id' => $schema->string()->required()->description('Document ID (ULID)')];
    }
}
