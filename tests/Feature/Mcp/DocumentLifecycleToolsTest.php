<?php

use App\Actions\FinalizeDocument;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Mcp\Tools\CancelInvoiceTool;
use App\Mcp\Tools\ConvertDocumentTool;
use App\Mcp\Tools\FinalizeDocumentTool;
use App\Mcp\Tools\GetDocumentPdfUrlTool;
use App\Mcp\Tools\SetDocumentStatusTool;
use App\Mcp\Tools\UpdateDocumentTool;
use App\Models\DocumentTypeSetting;
use App\Models\FieldDefinition;

it('finalizes a draft once', function () {
    $draft = draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')]);

    $done = mcpJson(mcpTool(FinalizeDocumentTool::class, ['id' => $draft->id])->assertOk());

    expect($done)->toMatchArray(['status' => 'open', 'number' => 'INV-'.now()->format('Y').'-0001', 'is_locked' => true])
        ->and($done['totals']['gross'])->toBe('1130.50');
    mcpTool(FinalizeDocumentTool::class, ['id' => $draft->id])->assertHasErrors(['(reason: document_locked)']);
});

it('lists the missing data with paths when the profile check fails and uses no number (review focus 4)', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'po_number', 'label' => 'PO number', 'required' => true, 'doc_types' => ['invoice']]);
    $draft = draft(DocumentType::Invoice);

    mcpTool(FinalizeDocumentTool::class, ['id' => $draft->id])
        ->assertHasErrors(['(reason: compliance_failed)', '"path":"document.custom.po_number"', 'PO number is missing.']);

    expect($draft->fresh()->status->value)->toBe('draft')
        ->and($draft->fresh()->number)->toBeNull();
});

it('sets the status of a finalized document and refuses other transitions', function () {
    $done = app(FinalizeDocument::class)->handle(systemActor(), draft());

    expect(mcpJson(mcpTool(SetDocumentStatusTool::class, ['id' => $done->id, 'status' => 'paid'])->assertOk()))
        ->toMatchArray(['id' => $done->id, 'status' => 'paid']);
    mcpTool(SetDocumentStatusTool::class, ['id' => draft()->id, 'status' => 'paid'])->assertHasErrors(['(reason: status_transition)']);
    mcpTool(SetDocumentStatusTool::class, ['id' => $done->id, 'status' => 'archived'])->assertHasErrors(['- status: ']);
});

it('converts an accepted offer into an invoice draft', function () {
    $offer = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Offer));
    mcpTool(SetDocumentStatusTool::class, ['id' => $offer->id, 'status' => 'accepted'])->assertOk();

    $invoice = mcpJson(mcpTool(ConvertDocumentTool::class, ['id' => $offer->id, 'type' => 'invoice'])->assertOk());

    expect($invoice)->toMatchArray(['type' => 'invoice', 'status' => 'draft', 'source_id' => $offer->id, 'dropped_fields' => []]);
    mcpTool(ConvertDocumentTool::class, ['id' => $offer->id, 'type' => 'cancellation'])->assertHasErrors(['- type: ']);
    mcpTool(ConvertDocumentTool::class, ['id' => $invoice['id'], 'type' => 'confirmation'])->assertHasErrors(['(reason: ']);
});

it('creates the cancellation draft of an invoice and returns the same one again', function () {
    $invoice = app(FinalizeDocument::class)->handle(systemActor(), draft());

    $first = mcpJson(mcpTool(CancelInvoiceTool::class, ['id' => $invoice->id])->assertOk());
    $second = mcpJson(mcpTool(CancelInvoiceTool::class, ['id' => $invoice->id])->assertOk());

    expect($first)->toMatchArray(['type' => 'cancellation', 'status' => 'draft', 'source_id' => $invoice->id])
        ->and($second['id'])->toBe($first['id']);
    mcpTool(CancelInvoiceTool::class, ['id' => draft(DocumentType::Offer)->id])->assertHasErrors(['(reason: ']);
});

it('hands out a signed PDF link of a draft that works without a token until the draft changes', function () {
    $this->freezeTime();
    $draft = draft();

    $links = mcpJson(mcpTool(GetDocumentPdfUrlTool::class, ['id' => $draft->id])->assertOk());

    expect($links)->toMatchArray(['document_id' => $draft->id, 'number' => null, 'status' => 'draft', 'xml' => null])
        ->and($links['pdf']['url'])->toContain("/api/downloads/documents/{$draft->id}/pdf")
        ->and($links['pdf']['expires_at'])->toBe(now()->addMinutes(15)->toAtomString());
    $this->get($links['pdf']['url'])->assertOk()->assertHeader('Content-Type', 'application/pdf');

    mcpTool(UpdateDocumentTool::class, ['id' => $draft->id, 'intro' => 'Changed'])->assertOk();
    $this->get($links['pdf']['url'])->assertForbidden();
});

it('adds the XML link for a finalized e-invoice', function () {
    completeOrganization();
    DocumentTypeSetting::query()->whereIn('type', ['invoice', 'cancellation'])->update(['profile' => 'en16931']);
    $invoice = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')], [
        'service_date' => now()->toDateString(), 'due_date' => now()->addDays(14)->toDateString(),
    ]));

    $links = mcpJson(mcpTool(GetDocumentPdfUrlTool::class, ['id' => $invoice->id])->assertOk());

    expect($links['number'])->toBe($invoice->number);
    $this->get($links['pdf']['url'])->assertOk()->assertHeader('Content-Type', 'application/pdf');
    expect($this->get($links['xml']['url'])->assertOk()->getContent())->toContain($invoice->number);
});

it('names an unknown document instead of handing out a link (review #8)', function () {
    $response = mcpTool(GetDocumentPdfUrlTool::class, ['id' => '01jaaaaaaaaaaaaaaaaaaaaaaa'])
        ->assertHasErrors(["Invalid input:\n- id: There is no document with the ID 01jaaaaaaaaaaaaaaaaaaaaaaa."]);

    $response->assertDontSee('/api/downloads/');
});
