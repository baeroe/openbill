<?php

use App\Actions\FinalizeDocument;
use App\Actions\SetDocumentStatus;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Models\Document;
use App\Models\FieldDefinition;
use Tests\Support\GotenbergFake;

beforeEach(fn () => $this->withToken(apiToken()));

it('finalizes a draft once', function () {
    $draft = draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')]);

    $this->postJson("/api/documents/{$draft->id}/finalize")
        ->assertOk()
        ->assertJsonPath('status', 'open')
        ->assertJsonPath('number', 'INV-'.now()->format('Y').'-0001')
        ->assertJsonPath('is_locked', true)
        ->assertJsonPath('totals.gross', '1130.50');

    $this->postJson("/api/documents/{$draft->id}/finalize")
        ->assertStatus(409)
        ->assertJsonPath('reason', 'document_locked');
});

it('lists every missing piece with a stable code when the profile check fails', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'order_ref', 'label' => 'Order reference', 'required' => true, 'doc_types' => ['invoice']]);
    $draft = draft(DocumentType::Invoice, [['kind' => 'text', 'title' => 'Note', 'description' => '']], ['customer_id' => null]);

    $response = $this->postJson("/api/documents/{$draft->id}/finalize")
        ->assertUnprocessable()
        ->assertJsonPath('reason', 'compliance_failed');

    expect(collect($response->json('violations'))->pluck('code')->all())
        ->toContain('customer_missing', 'no_items', 'document_field_missing')
        ->and($draft->fresh()->number)->toBeNull();
});

it('rolls back when Gotenberg is down: 503 and still a draft', function () {
    GotenbergFake::failWithError();
    $draft = draft();

    $this->postJson("/api/documents/{$draft->id}/finalize")
        ->assertStatus(503)
        ->assertJsonPath('reason', 'pdf_render_failed');

    expect($draft->fresh()->status)->toBe(DocumentStatus::Draft)
        ->and($draft->fresh()->number)->toBeNull();
});

it('sets a status and refuses impossible or unknown ones', function () {
    $invoice = app(FinalizeDocument::class)->handle(systemActor(), draft());

    $this->postJson("/api/documents/{$invoice->id}/status", ['status' => 'accepted'])
        ->assertStatus(409)
        ->assertJsonPath('reason', 'status_transition');
    $this->postJson("/api/documents/{$invoice->id}/status", ['status' => 'bogus'])
        ->assertUnprocessable()
        ->assertJsonPath('violations.0.path', 'status');
    $this->postJson("/api/documents/{$invoice->id}/status", ['status' => 'paid'])
        ->assertOk()
        ->assertJsonPath('status', 'paid')
        ->assertJsonPath('paid_at', fn (?string $value): bool => $value !== null);
});

it('converts an accepted offer and names the custom fields it dropped', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'response_time', 'doc_types' => ['offer']]);
    $offer = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Offer, [], ['custom' => ['response_time' => '48h']]));
    app(SetDocumentStatus::class)->handle(systemActor(), $offer, DocumentStatus::Accepted);

    $this->postJson("/api/documents/{$offer->id}/convert", ['type' => 'nonsense'])
        ->assertUnprocessable()
        ->assertJsonPath('violations.0.path', 'type');
    $this->postJson("/api/documents/{$offer->id}/convert", ['type' => 'invoice'])
        ->assertOk()
        ->assertJsonPath('type', 'invoice')
        ->assertJsonPath('status', 'draft')
        ->assertJsonPath('source_id', $offer->id)
        ->assertJsonPath('dropped_fields', ['document.response_time']);
});

it('creates one cancellation per invoice and refuses it for offers', function () {
    $invoice = app(FinalizeDocument::class)->handle(systemActor(), draft());

    $first = $this->postJson("/api/documents/{$invoice->id}/cancel")->assertOk()->assertJsonPath('type', 'cancellation')->json('id');
    $this->postJson("/api/documents/{$invoice->id}/cancel")->assertOk()->assertJsonPath('id', $first);

    $offer = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Offer));
    $this->postJson("/api/documents/{$offer->id}/cancel")->assertStatus(409)->assertJsonPath('reason', 'conversion');
});

it('duplicates a document as a new draft and refuses cancellations', function () {
    $invoice = app(FinalizeDocument::class)->handle(systemActor(), draft());

    $copy = $this->postJson("/api/documents/{$invoice->id}/duplicate")
        ->assertCreated()
        ->assertJsonPath('status', 'draft')
        ->assertJsonPath('number', null)
        ->json('id');
    expect($copy)->not->toBe($invoice->id);

    $cancellation = Document::query()->findOrFail($this->postJson("/api/documents/{$invoice->id}/cancel")->json('id'));
    $this->postJson("/api/documents/{$cancellation->id}/duplicate")
        ->assertStatus(409)
        ->assertJsonPath('reason', 'duplicate_cancellation');
});
