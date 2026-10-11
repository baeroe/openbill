<?php

use App\Actions\FinalizeDocument;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Models\Customer;
use App\Models\FieldDefinition;

beforeEach(fn () => $this->withToken(apiToken()));

it('creates a customer with contacts, the default contact first', function () {
    $response = $this->postJson('/api/customers', [
        'name' => 'Hafenkontor Lindqvist GmbH',
        'street' => 'Kaistraße 4', 'zip' => '20457', 'city' => 'Hamburg', 'country' => 'de',
        'contacts' => [
            ['first_name' => 'Ole', 'last_name' => 'Brandt', 'email' => 'ole@hafenkontor.example'],
            ['first_name' => 'Mira', 'last_name' => 'Lindqvist', 'email' => 'mira@hafenkontor.example', 'is_default' => true],
        ],
    ])->assertCreated();

    $response->assertJsonPath('number', 'C-1001')
        ->assertJsonPath('country', 'DE')
        ->assertJsonPath('tax_treatment', 'domestic')
        ->assertJsonPath('contacts.0.last_name', 'Lindqvist')
        ->assertJsonPath('contacts.0.is_default', true)
        ->assertJsonCount(2, 'contacts');
    expect($response->getContent())->toContain('"custom":{}');
});

it('validates custom fields of customer and contacts with paths and saves nothing (review focus 4)', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Customer, 'key' => 'industry', 'label' => 'Industry', 'type' => FieldType::Select, 'options' => ['Logistics', 'Retail'], 'doc_types' => []]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Contact, 'key' => 'birthday', 'label' => 'Birthday', 'type' => FieldType::Date, 'doc_types' => []]);

    $response = $this->postJson('/api/customers', [
        'name' => 'Fjord Analytics AB',
        'custom' => ['industry' => 'Mining'],
        'contacts' => [['last_name' => 'Berg', 'custom' => ['birthday' => 'soon']]],
    ])->assertUnprocessable()->assertJsonPath('reason', 'validation_failed');

    expect(collect($response->json('violations'))->pluck('path')->all())
        ->toEqualCanonicalizing(['custom.industry', 'contacts.0.custom.birthday'])
        ->and(Customer::query()->count())->toBe(0);
});

it('changes only the given fields and keeps the contacts', function () {
    $id = $this->postJson('/api/customers', ['name' => 'Hotel Alpenglück', 'contacts' => [['last_name' => 'Huber']]])->json('id');

    $this->patchJson("/api/customers/{$id}", ['email' => 'rezeption@alpenglueck.example'])
        ->assertOk()
        ->assertJsonPath('name', 'Hotel Alpenglück')
        ->assertJsonPath('email', 'rezeption@alpenglueck.example')
        ->assertJsonPath('contacts.0.last_name', 'Huber');
});

it('searches and pages through customers', function () {
    Customer::factory()->count(35)->create(['name' => 'Kulturwerk Elbinsel e. V.']);
    Customer::factory()->create(['name' => 'Hotel Alpenglück']);

    $page = $this->get('/api/customers?page=2', ['Accept' => 'application/ld+json'])->assertOk()->json();
    expect($page['totalItems'])->toBe(36)
        ->and($page['member'])->toHaveCount(6)
        ->and($page['view']['@id'])->toContain('page=2');

    $this->getJson('/api/customers?q=alpengl')->assertOk()->assertJsonCount(1)->assertJsonPath('0.name', 'Hotel Alpenglück');
    $this->getJson('/api/customers?q=%25')->assertOk()->assertJsonCount(0);
    $this->getJson('/api/customers?itemsPerPage=5')->assertOk()->assertJsonCount(5);
});

it('deletes a customer without finalized documents and refuses it otherwise', function () {
    $free = Customer::factory()->create();
    $this->deleteJson("/api/customers/{$free->id}")->assertNoContent();
    $this->getJson("/api/customers/{$free->id}")->assertNotFound();

    $document = app(FinalizeDocument::class)->handle(systemActor(), draft());
    $this->deleteJson("/api/customers/{$document->customer_id}")
        ->assertStatus(409)
        ->assertJsonPath('reason', 'customer_has_finalized_documents');
});
