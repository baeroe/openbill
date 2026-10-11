<?php

use App\Enums\FieldScope;
use App\Models\FieldDefinition;

beforeEach(fn () => $this->withToken(apiToken()));

it('reads and changes the organization', function () {
    $this->patchJson('/api/organization', ['name' => 'Studio Nordlicht', 'country' => 'de', 'vat_id' => 'DE123456789'])
        ->assertOk()
        ->assertJsonPath('name', 'Studio Nordlicht')
        ->assertJsonPath('country', 'DE')
        ->assertJsonPath('has_logo', false);

    $this->getJson('/api/organization')->assertOk()->assertJsonPath('vat_id', 'DE123456789');
    expect($this->get('/api/organization', ['Accept' => 'application/ld+json'])->json('@id'))->toBe('/api/organization');
});

it('validates custom fields of the organization with their path', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Org, 'key' => 'founded', 'label' => 'Founded', 'type' => 'date', 'doc_types' => []]);

    $this->patchJson('/api/organization', ['custom' => ['founded' => 'long ago']])
        ->assertUnprocessable()
        ->assertJsonPath('violations.0.path', 'custom.founded');
});

it('lists the document types with their numbering and the next number', function () {
    $this->getJson('/api/document-types')->assertOk()->assertJsonCount(4);

    $this->getJson('/api/document-types/invoice')
        ->assertOk()
        ->assertJsonPath('type', 'invoice')
        ->assertJsonPath('profile', 'basic')
        ->assertJsonPath('payment_term_days', 14)
        ->assertJsonPath('numbering.pattern', 'INV-{YYYY}-{0000}')
        ->assertJsonPath('numbering.reset_yearly', true)
        ->assertJsonPath('numbering.next_value', 1)
        ->assertJsonPath('numbering.next_number', 'INV-'.now()->format('Y').'-0001');
});

it('changes a document type and refuses what its type does not allow', function () {
    $this->patchJson('/api/document-types/invoice', ['profile' => 'en16931', 'numbering' => ['next_value' => 42]])
        ->assertOk()
        ->assertJsonPath('profile', 'en16931')
        ->assertJsonPath('numbering.next_number', 'INV-'.now()->format('Y').'-0042');

    $this->patchJson('/api/document-types/offer', ['profile' => 'en16931'])
        ->assertUnprocessable()
        ->assertJsonPath('violations.0.path', 'profile');
    $this->patchJson('/api/document-types/offer', ['numbering' => ['pattern' => 'Q-{0000}']])
        ->assertUnprocessable()
        ->assertJsonPath('violations.0.path', 'numbering.pattern');
    $this->getJson('/api/document-types/letter')->assertNotFound();
});
