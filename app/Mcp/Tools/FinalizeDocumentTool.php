<?php

namespace App\Mcp\Tools;

use App\Actions\FinalizeDocument;
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
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;

#[Name('finalize-document')]
#[Title('Finalize document')]
#[Description('Finalize a draft: checks the profile (basic or EN 16931 e-invoice), assigns the number, freezes customer and organization data and archives the PDF (and the e-invoice XML). It cannot be undone – ask the user first. When data is missing, the error (reason compliance_failed) lists every issue with its path; fix them with update-document, update-customer or update-organization.')]
#[IsDestructive]
#[IsOpenWorld(false)]
final class FinalizeDocumentTool extends OpenbillTool
{
    public function __construct(
        private readonly FinalizeDocument $finalize,
        private readonly DocumentInspector $inspector,
    ) {}

    protected function run(Request $request, Actor $actor): Response
    {
        $done = $this->finalize->handle($actor, self::find($request, Document::class, 'document'));

        return Output::json(Output::resource(DocumentResource::fromModel(DocumentProvider::load($done->id), $this->inspector)));
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return ['id' => $schema->string()->required()->description('ID of the draft (ULID)')];
    }
}
