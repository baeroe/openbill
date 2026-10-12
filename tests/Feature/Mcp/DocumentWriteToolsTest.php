<?php

use App\Actions\FinalizeDocument;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Exceptions\ActionNotAllowedException;
use App\Mcp\Tools\CreateDocumentTool;
use App\Mcp\Tools\DuplicateDocumentTool;
use App\Mcp\Tools\UpdateDocumentTool;
use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Models\FieldDefinition;

it('creates a draft with groups and answers with its totals like the REST API', function () {
    $customer = Customer::factory()->create(['name' => 'Hafenkontor Lindqvist GmbH']);

    $offer = mcpJson(mcpTool(CreateDocumentTool::class, [
        'type' => 'offer',
        'customer_id' => $customer->id,
        'groups' => [
            ['title' => 'Workshop', 'positions' => [itemRow('Discovery workshop', '8', '120')]],
            ['title' => 'Options', 'positions' => [itemRow('Hosting', '12', '49', ['kind' => 'optional'])]],
        ],
    ])->assertOk());

    expect($offer)->toMatchArray(['type' => 'offer', 'status' => 'draft', 'number' => null, 'customer_name' => 'Hafenkontor Lindqvist GmbH'])
        ->and($offer['totals']['net'])->toBe('960.00')
        ->and($offer['totals']['optional_net'])->toBe('588.00')
        ->and($offer)->toBe($this->withToken(apiToken(['api:read']))->getJson("/api/documents/{$offer['id']}")->json());
});

it('refuses to create a cancellation directly', function () {
    mcpTool(CreateDocumentTool::class, ['type' => 'cancellation'])
        ->assertHasErrors(['(reason: '.ActionNotAllowedException::cancellationNeedsInvoice()->reason().')']);

    expect(Document::query()->count())->toBe(0);
});

it('saves only the sent keys of a draft and replaces the groups', function () {
    $draft = draft(DocumentType::Invoice, [itemRow('Support', '1', '80')]);
    $events = $draft->events()->count();

    $saved = mcpJson(mcpTool(UpdateDocumentTool::class, [
        'id' => $draft->id,
        'due_date' => '2026-11-30',
        'groups' => [['title' => null, 'positions' => [itemRow('Support', '2', '80')]]],
    ])->assertOk());

    expect($saved)->toMatchArray(['id' => $draft->id, 'due_date' => '2026-11-30', 'customer_id' => $draft->customer_id])
        ->and($saved['totals']['net'])->toBe('160.00')
        ->and($draft->events()->count())->toBe($events + 1);
});

it('rejects invalid input with field paths and saves nothing (review focus 4)', function (Closure $patch, string $path) {
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'priority', 'label' => 'Priority', 'type' => FieldType::Select, 'options' => ['low', 'high'], 'doc_types' => ['invoice']]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'delivery', 'label' => 'Delivery', 'type' => FieldType::Date, 'doc_types' => ['offer']]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Position, 'key' => 'billable', 'label' => 'Billable', 'type' => FieldType::Boolean, 'doc_types' => ['invoice']]);
    $document = draft(DocumentType::Invoice, [itemRow('Support', '1', '80')]);
    $before = $document->fresh()->toArray();
    $events = $document->events()->count();

    mcpTool(UpdateDocumentTool::class, ['id' => $document->id, ...$patch()])->assertHasErrors(["- {$path}: "]);

    expect($document->fresh()->toArray())->toBe($before)
        ->and($document->events()->count())->toBe($events);
})->with([
    'unknown option' => [fn () => ['custom' => ['priority' => 'urgent']], 'custom.priority'],
    'field of another document type' => [fn () => ['custom' => ['delivery' => '2026-10-20']], 'custom.delivery'],
    'unknown field' => [fn () => ['custom' => ['colour' => 'red']], 'custom.colour'],
    'wrong type in a position' => [fn () => ['groups' => [['title' => null, 'positions' => [itemRow('Support', '1', '80', ['custom' => ['billable' => 'yes']])]]]], 'groups.0.positions.0.custom.billable'],
    'amount as JSON number' => [fn () => ['groups' => [['title' => null, 'positions' => [itemRow('Support', '1', '80', ['unit_price' => 80.5])]]]], 'groups.0.positions.0.unit_price'],
    'optional position in an invoice' => [fn () => ['groups' => [['title' => null, 'positions' => [itemRow('Support', '1', '80', ['kind' => 'optional'])]]]], 'groups.0.positions.0.kind'],
    'contact of another customer' => [fn () => ['contact_id' => Contact::factory()->create()->id], 'contact_id'],
]);

it('rejects the same input over HTTP with the path in the tool error', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'priority', 'label' => 'Priority', 'type' => FieldType::Select, 'options' => ['low', 'high'], 'doc_types' => ['invoice']]);
    $document = draft(DocumentType::Invoice);

    $call = mcpCall(apiToken(['mcp']), 'update-document', ['id' => $document->id, 'custom' => ['priority' => 'urgent']]);

    expect($call['error'])->toBeTrue()
        ->and($call['text'])->toStartWith("Invalid input:\n- custom.priority: ");
});

it('refuses to change a finalized document', function () {
    $done = app(FinalizeDocument::class)->handle(systemActor(), draft());
    $before = $done->fresh()->toArray();

    mcpTool(UpdateDocumentTool::class, ['id' => $done->id, 'intro' => 'Changed'])->assertHasErrors(['(reason: document_locked)']);

    expect($done->fresh()->toArray())->toBe($before);
});

it('duplicates a document as a new draft and leaves the source alone', function () {
    $source = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')]));

    $copy = mcpJson(mcpTool(DuplicateDocumentTool::class, ['id' => $source->id])->assertOk());

    expect($copy['id'])->not->toBe($source->id)
        ->and($copy)->toMatchArray(['type' => 'invoice', 'status' => 'draft', 'number' => null])
        ->and($copy['groups'][0]['positions'][0]['title'])->toBe('Workshop')
        ->and($source->fresh()->status->value)->toBe('open');
});
