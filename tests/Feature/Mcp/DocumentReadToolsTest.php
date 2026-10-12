<?php

use App\Enums\DocumentType;
use App\Mcp\Tools\GetDocumentTool;
use App\Mcp\Tools\ListDocumentsTool;

it('lists documents in the short form of the REST list, filtered and paged', function () {
    draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')]);
    draft(DocumentType::Offer);

    $page = mcpJson(mcpTool(ListDocumentsTool::class, ['type' => 'invoice'])->assertOk());
    $rest = $this->withToken(apiToken(['api:read']))->getJson('/api/documents?type=invoice')->assertOk()->json();

    expect($page)->toMatchArray(['page' => 1, 'per_page' => 30, 'total' => 1, 'has_more' => false])
        ->and($page['items'])->toBe($rest)
        ->and($page['items'][0])->not->toHaveKeys(['groups', 'totals', 'issues', 'intro'])
        ->and($page['items'][0]['gross_total'])->toBe('1130.50');
});

it('refuses invalid filters and paging with their path', function () {
    mcpTool(ListDocumentsTool::class, ['status' => 'archived'])->assertHasErrors(['- status: ']);
    mcpTool(ListDocumentsTool::class, ['per_page' => 500])->assertHasErrors(['- per_page: ']);
});

it('returns one document completely like GET /api/documents/{id}', function () {
    $invoice = draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')]);

    $document = mcpJson(mcpTool(GetDocumentTool::class, ['id' => $invoice->id])->assertOk());

    expect($document)->toBe($this->withToken(apiToken(['api:read']))->getJson("/api/documents/{$invoice->id}")->json())
        ->and($document['groups'][0]['positions'][0]['title'])->toBe('Workshop')
        ->and($document['totals']['gross'])->toBe('1130.50');
});

it('names an unknown document', function () {
    mcpTool(GetDocumentTool::class, ['id' => '01jaaaaaaaaaaaaaaaaaaaaaaa'])->assertHasErrors(['There is no document with the ID']);
});
