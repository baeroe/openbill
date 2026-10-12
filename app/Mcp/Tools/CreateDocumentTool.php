<?php

namespace App\Mcp\Tools;

use App\Actions\CreateDocument;
use App\ApiResource\DocumentResource;
use App\Mcp\Output;
use App\Mcp\Schemas;
use App\State\Provider\DocumentProvider;
use App\Support\Actor;
use App\Support\DocumentInspector;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[Name('create-document')]
#[Description('Create a draft: type offer, confirmation or invoice (a cancellation comes from cancel-invoice), customer_id, and any field update-document takes, e.g. groups with positions. Dates, payment term, validity, texts and template come from the document type settings unless sent. Answers like get-document, with totals and issues.')]
#[IsDestructive(false)]
final class CreateDocumentTool extends OpenbillTool
{
    public function __construct(
        private readonly CreateDocument $create,
        private readonly DocumentInspector $inspector,
    ) {}

    protected function run(Request $request, Actor $actor): Response
    {
        $document = $this->create->handle($actor, $request->all());

        return Output::json(Output::resource(DocumentResource::fromModel(DocumentProvider::load($document->id), $this->inspector)));
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'type' => $schema->string()->enum(['offer', 'confirmation', 'invoice'])->required(),
            ...Schemas::draft($schema),
        ];
    }
}
