<?php

namespace App\Mcp\Tools;

use App\Actions\UpdateDraft;
use App\ApiResource\DocumentResource;
use App\Mcp\Output;
use App\Mcp\Schemas;
use App\Models\Document;
use App\State\Provider\DocumentProvider;
use App\Support\Actor;
use App\Support\DocumentInspector;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Arr;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;

#[Name('update-document')]
#[Title('Update draft')]
#[Description('Change a draft. Only the keys you send change; "groups", when sent, replaces all groups and positions (send their ids to keep them). Amounts and quantities are strings. Finalized documents cannot be changed (reason document_locked). Answers like get-document: check "issues" before finalize-document.')]
#[IsDestructive]
#[IsIdempotent]
#[IsOpenWorld(false)]
final class UpdateDocumentTool extends OpenbillTool
{
    public function __construct(
        private readonly UpdateDraft $update,
        private readonly DocumentInspector $inspector,
    ) {}

    protected function run(Request $request, Actor $actor): Response
    {
        $document = self::find($request, Document::class, 'document');
        $document = $this->update->handle($actor, $document, Arr::except($request->all(), ['id']));

        return Output::json(Output::resource(DocumentResource::fromModel(DocumentProvider::load($document->id), $this->inspector)));
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()->required()->description('Document ID (ULID)'),
            ...Schemas::draft($schema),
        ];
    }
}
