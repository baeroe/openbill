<?php

namespace App\Mcp\Tools;

use App\Actions\LinkDocumentFiles;
use App\Mcp\Output;
use App\Models\Document;
use App\Support\Actor;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('get-document-pdf-url')]
#[Title('PDF and XML links')]
#[Description('Signed download links, valid for 15 minutes without a token: "pdf" always (a draft is rendered live with a watermark, a finalized document comes from the archive) and "xml" for a finalized e-invoice. A draft link stops working once the draft changes. Give the link to the user instead of downloading the file.')]
#[IsReadOnly]
#[IsOpenWorld(false)]
final class GetDocumentPdfUrlTool extends OpenbillTool
{
    public function __construct(private readonly LinkDocumentFiles $links) {}

    protected function run(Request $request, Actor $actor): Response
    {
        return Output::json($this->links->handle($actor, self::find($request, Document::class, 'document')));
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return ['id' => $schema->string()->required()->description('Document ID (ULID)')];
    }
}
