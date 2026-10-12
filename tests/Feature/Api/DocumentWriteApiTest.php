<?php

use App\Actions\FinalizeDocument;
use App\Enums\ActorType;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentEvent;
use App\Models\FieldDefinition;

beforeEach(fn () => $this->withToken(apiToken()));

it('creates a draft with groups and answers with its totals', function () {
    $customer = Customer::factory()->create(['name' => 'Studio Nordlicht']);

    $this->postJson('/api/documents', [
        'type' => 'invoice',
        'customer_id' => $customer->id,
        'groups' => [['title' => 'Workshop', 'positions' => [itemRow('Discovery', '8', '120')]]],
    ])
        ->assertCreated()
        ->assertJsonPath('type', 'invoice')
        ->assertJsonPath('status', 'draft')
        ->assertJsonPath('customer_name', 'Studio Nordlicht')
        ->assertJsonPath('groups.0.title', 'Workshop')
        ->assertJsonPath('totals.net', '960.00')
        ->assertJsonPath('gross_total', '1142.40');
});

it('saves a draft like autosave does and answers with the new totals, logged for the token', function () {
    $document = draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')]);
    $group = $document->groups[0];

    $this->patchJson("/api/documents/{$document->id}", [
        'intro' => 'As agreed:',
        'groups' => [['id' => $group->id, 'title' => null, 'positions' => [itemRow('Workshop', '2', '95', ['id' => $group->positions[0]->id])]]],
    ])
        ->assertOk()
        ->assertJsonPath('intro', 'As agreed:')
        ->assertJsonPath('groups.0.positions.0.id', $group->positions[0]->id)
        ->assertJsonPath('totals.net', '190.00')
        ->assertJsonPath('net_total', '190.00');

    expect($document->events()->get()->last()->actor_type)->toBe(ActorType::Token);
});

it('refuses to change or delete a finalized document and leaves it untouched', function () {
    $document = app(FinalizeDocument::class)->handle(systemActor(), draft());
    $before = $document->fresh()->toArray();

    $this->patchJson("/api/documents/{$document->id}", ['intro' => 'Changed'])
        ->assertStatus(409)
        ->assertJsonPath('reason', 'document_locked')
        ->assertJsonPath('document_id', $document->id)
        ->assertJsonPath('number', $document->number);
    $this->deleteJson("/api/documents/{$document->id}")->assertStatus(409)->assertJsonPath('reason', 'document_locked');

    expect($document->fresh()->toArray())->toBe($before);
});

it('rejects invalid input with field paths and saves nothing (review focus 4)', function (Closure $patch, string $path) {
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'priority', 'label' => 'Priority', 'type' => FieldType::Select, 'options' => ['low', 'high'], 'doc_types' => ['invoice']]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'delivery', 'label' => 'Delivery', 'type' => FieldType::Date, 'doc_types' => ['offer']]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Position, 'key' => 'billable', 'label' => 'Billable', 'type' => FieldType::Boolean, 'doc_types' => ['invoice']]);
    $document = draft(DocumentType::Invoice, [itemRow('Support', '1', '80')]);
    $before = $document->fresh()->toArray();
    $events = $document->events()->count();

    $response = $this->patchJson("/api/documents/{$document->id}", $patch())
        ->assertUnprocessable()
        ->assertJsonPath('reason', 'validation_failed');

    expect(collect($response->json('violations'))->pluck('path')->all())->toContain($path)
        ->and($document->fresh()->toArray())->toBe($before)
        ->and($document->events()->count())->toBe($events);
})->with([
    'unknown option' => [fn () => ['custom' => ['priority' => 'urgent']], 'custom.priority'],
    'field of another document type' => [fn () => ['custom' => ['delivery' => '2026-10-20']], 'custom.delivery'],
    'unknown field' => [fn () => ['custom' => ['colour' => 'red']], 'custom.colour'],
    'wrong type in a position' => [fn () => ['groups' => [['title' => null, 'positions' => [itemRow('Support', '1', '80', ['custom' => ['billable' => 'yes']])]]]], 'groups.0.positions.0.custom.billable'],
    'amount as JSON number' => [fn () => ['groups' => [['title' => null, 'positions' => [itemRow('Support', '1', '80', ['unit_price' => 80.5])]]]], 'groups.0.positions.0.unit_price'],
    'optional position in an invoice' => [fn () => ['groups' => [['title' => null, 'positions' => [itemRow('Support', '1', '80', ['kind' => 'optional'])]]]], 'groups.0.positions.0.kind'],
    'contact of another customer' => [fn () => ['contact_id' => Contact::factory()->create()->id], 'contact_id'],
    'integer beyond DECIMAL(15,4) (review M2)' => [fn () => ['groups' => [['title' => null, 'positions' => [itemRow('Support', '1', '80', ['quantity' => PHP_INT_MAX])]]]], 'groups.0.positions.0.quantity'],
    'line total beyond DECIMAL(15,2) (review M2)' => [fn () => ['groups' => [['title' => null, 'positions' => [itemRow('Support', '99999999999', '99999999999')]]]], 'groups.0.positions.0.unit_price'],
]);

it('refuses to create a cancellation directly', function () {
    $this->postJson('/api/documents', ['type' => 'cancellation'])
        ->assertStatus(409)
        ->assertJsonPath('reason', 'cancellation_needs_invoice');
});

it('deletes a draft and logs it with the token as actor', function () {
    $document = draft();

    $this->deleteJson("/api/documents/{$document->id}")->assertNoContent();

    expect(Document::query()->find($document->id))->toBeNull()
        ->and(DocumentEvent::query()->where('action', EventAction::Deleted)->sole()->actor_type)->toBe(ActorType::Token);
    $this->getJson("/api/documents/{$document->id}")->assertNotFound();
});
