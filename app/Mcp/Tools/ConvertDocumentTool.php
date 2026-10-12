<?php

namespace App\Mcp\Tools;

use App\Actions\ConvertDocument;
use App\ApiResource\DocumentResource;
use App\Enums\DocumentType;
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
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;

#[Name('convert-document')]
#[Title('Convert document')]
#[Description('Create the next document from a finalized one as a new draft: an accepted offer into a confirmation or an invoice, a confirmation into an invoice. Groups, positions and matching custom values move along; "dropped_fields" names custom values the target type does not use. For a cancellation use cancel-invoice.')]
#[IsDestructive(false)]
#[IsOpenWorld(false)]
final class ConvertDocumentTool extends OpenbillTool
{
    public function __construct(
        private readonly ConvertDocument $convert,
        private readonly DocumentInspector $inspector,
    ) {}

    protected function run(Request $request, Actor $actor): Response
    {
        $source = self::find($request, Document::class, 'document');
        $type = DocumentType::from((string) $request->validate(['type' => ['required', Rule::in(['confirmation', 'invoice'])]])['type']);
        $result = $this->convert->handle($actor, $source, $type);

        return Output::json(Output::resource(DocumentResource::fromModel(DocumentProvider::load($result->document->id), $this->inspector, $result->droppedFields)));
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()->required()->description('ID of the finalized source document (ULID)'),
            'type' => $schema->string()->enum(['confirmation', 'invoice'])->required(),
        ];
    }
}
