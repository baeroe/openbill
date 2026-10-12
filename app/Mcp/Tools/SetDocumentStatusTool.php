<?php

namespace App\Mcp\Tools;

use App\Actions\SetDocumentStatus;
use App\ApiResource\DocumentResource;
use App\Enums\DocumentStatus;
use App\Mcp\Output;
use App\Models\Document;
use App\State\Provider\DocumentProvider;
use App\Support\Actor;
use App\Support\DocumentInspector;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;

#[Name('set-document-status')]
#[Title('Set document status')]
#[Description('Set the status of a finalized document by hand, e.g. an offer to accepted or rejected, a confirmation to done, an invoice to paid. Drafts get their status only from finalize-document; "cancelled" comes from finalizing a cancellation. Ask the user before marking an invoice as paid.')]
#[IsDestructive]
#[IsIdempotent]
#[IsOpenWorld(false)]
final class SetDocumentStatusTool extends OpenbillTool
{
    public function __construct(
        private readonly SetDocumentStatus $status,
        private readonly DocumentInspector $inspector,
    ) {}

    protected function run(Request $request, Actor $actor): Response
    {
        $document = self::find($request, Document::class, 'document');
        $status = DocumentStatus::from((string) $request->validate(['status' => ['required', Rule::enum(DocumentStatus::class)]])['status']);
        $document = $this->status->handle($actor, $document, $status);

        return Output::json(Output::resource(DocumentResource::fromModel(DocumentProvider::load($document->id), $this->inspector)));
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()->required()->description('Document ID (ULID)'),
            'status' => $schema->string()->enum(['open', 'accepted', 'rejected', 'done', 'paid'])->required(),
        ];
    }
}
