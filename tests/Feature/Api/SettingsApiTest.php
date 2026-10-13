<?php

use App\Enums\FieldScope;
use App\Models\Customer;
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

it('reads, previews and changes the customer numbering', function () {
    $this->travelTo('2026-10-13 10:00:00');

    $this->getJson('/api/customer-numbering')
        ->assertOk()
        ->assertExactJson(['pattern' => 'C-{0000}', 'reset_yearly' => false, 'next_value' => 1001, 'next_number' => 'C-1001']);
    $this->getJson('/api/customer-numbering/preview?pattern=KD-{YY}-{000}&next_value=5')
        ->assertOk()
        ->assertExactJson(['number' => 'KD-26-005', 'valid' => true, 'message' => null]);
    $this->getJson('/api/customer-numbering/preview?pattern=KD-{0000}&reset_yearly=1')
        ->assertOk()
        ->assertJsonPath('valid', false);

    $this->patchJson('/api/customer-numbering', ['pattern' => '{YYYY}-{000}', 'reset_yearly' => true, 'next_value' => 12])
        ->assertOk()
        ->assertJsonPath('next_number', '2026-012');
    $this->patchJson('/api/customer-numbering', ['pattern' => 'K'])
        ->assertUnprocessable()
        ->assertJsonPath('violations.0.path', 'pattern');
    $this->postJson('/api/customers', ['name' => 'Hafenkontor Lindqvist GmbH'])->assertCreated()->assertJsonPath('number', '2026-012');
});

it('shows the customer number a new customer really gets when the wanted one is taken', function () {
    Customer::factory()->create(['number' => 'C-1001']);

    $this->getJson('/api/customer-numbering')->assertOk()->assertJsonPath('next_number', 'C-1002');
    $this->getJson('/api/customer-numbering/preview?pattern=C-{0000}')
        ->assertOk()
        ->assertJsonPath('number', 'C-1002')
        ->assertJsonPath('message', 'C-1001 exists already. New customers skip used numbers and get C-1002.');
});
