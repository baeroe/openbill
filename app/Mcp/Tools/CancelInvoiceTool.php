<?php

namespace App\Mcp\Tools;

use App\Actions\CancelInvoice;
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
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[Name('cancel-invoice')]
#[Description('Start the cancellation of an open or paid invoice: creates the cancellation draft (or returns the existing one). Finalizing that draft with finalize-document marks the invoice as cancelled – ask the user before you do.')]
#[IsDestructive]
#[IsIdempotent]
final class CancelInvoiceTool extends OpenbillTool
{
    public function __construct(
        private readonly CancelInvoice $cancel,
        private readonly DocumentInspector $inspector,
    ) {}

    protected function run(Request $request, Actor $actor): Response
    {
        $result = $this->cancel->handle($actor, self::find($request, Document::class, 'document'));

        return Output::json(Output::resource(DocumentResource::fromModel(DocumentProvider::load($result->document->id), $this->inspector, $result->droppedFields)));
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return ['id' => $schema->string()->required()->description('ID of the finalized invoice (ULID)')];
    }
}
