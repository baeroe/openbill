<?php

namespace App\Mcp\Tools;

use App\Actions\InspectTemplatePreview;
use App\Mcp\Output;
use App\Mcp\Schemas;
use App\Support\Actor;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('render-template-preview')]
#[Description('Render a template on the server and report what matters, never the HTML: "errors" (Liquid errors with part, line and message), "page_count" of the PDF (null with errors, when the PDF service is unreachable or after 20 page counts a minute; "page_count_skipped" says why), "missing_fields" (expectedFields of the manifest that are not defined as custom fields or have another type), the compliance "issues" of a document, "totals", "paper" and a short "text_excerpt". Data: document_id or a sample scenario. Template: template_id (default: the document\'s template) and/or unsaved parts in "template" to try changes before update-template. Liquid reference: resource openbill://docs/liquid-reference.')]
#[IsReadOnly]
final class RenderTemplatePreviewTool extends OpenbillTool
{
    public function __construct(private readonly InspectTemplatePreview $inspect) {}

    protected function run(Request $request, Actor $actor): Response
    {
        return Output::json($this->inspect->handle($actor, $request->all(['template_id', 'template', 'document_id', 'scenario', 'locale'])));
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'template_id' => $schema->string()->description('Template to render (list-templates); default: the document\'s template, for scenarios Klar'),
            'template' => $schema->object(Schemas::templateParts($schema))->description('Unsaved parts that replace those of the template'),
            'document_id' => $schema->string()->description('Render this document (drafts with live master data, finalized ones from their snapshot)'),
            'scenario' => $schema->string()->enum(['short_invoice', 'long_invoice', 'small_business', 'reverse_charge', 'offer_with_options'])
                ->description('Sample data instead of a document'),
            'locale' => $schema->string()->enum(['en', 'de'])->description('Language of the sample data'),
        ];
    }
}
