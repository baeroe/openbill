<?php

use App\Enums\FieldScope;
use App\Models\FieldDefinition;

beforeEach(fn () => $this->withToken(apiToken()));

it('creates a field with a key from its label', function () {
    $this->postJson('/api/field-definitions', [
        'scope' => 'document', 'label' => 'Project name', 'type' => 'text', 'doc_types' => ['offer', 'invoice'],
    ])
        ->assertCreated()
        ->assertJsonPath('key', 'project_name')
        ->assertJsonPath('doc_types', ['offer', 'invoice'])
        ->assertJsonPath('required', false);
});

it('changes only the given keys', function () {
    $field = FieldDefinition::factory()->create([
        'scope' => FieldScope::Document, 'key' => 'priority', 'label' => 'Priority', 'type' => 'select',
        'options' => ['low', 'high'], 'doc_types' => ['invoice'],
    ]);

    $this->patchJson("/api/field-definitions/{$field->id}", ['label' => 'Urgency'])
        ->assertOk()
        ->assertJsonPath('label', 'Urgency')
        ->assertJsonPath('options', ['low', 'high'])
        ->assertJsonPath('doc_types', ['invoice'])
        ->assertJsonPath('key', 'priority');
});

it('refuses reserved keys with the path key', function () {
    $this->postJson('/api/field-definitions', ['scope' => 'customer', 'key' => 'vat_id', 'label' => 'VAT', 'type' => 'text'])
        ->assertUnprocessable()
        ->assertJsonPath('violations.0.path', 'key');
});

it('filters by scope and document type', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'offer_only', 'doc_types' => ['offer']]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'invoice_only', 'doc_types' => ['invoice']]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Customer, 'key' => 'industry', 'doc_types' => []]);

    $keys = fn (string $query): array => collect($this->getJson("/api/field-definitions?{$query}")->assertOk()->json())->pluck('key')->all();

    expect($keys('scope=document&doc_type=invoice'))->toBe(['invoice_only'])
        ->and($keys('doc_type=invoice'))->toEqualCanonicalizing(['invoice_only', 'industry'])
        ->and($keys('scope=customer'))->toBe(['industry']);
});

it('deletes a field', function () {
    $field = FieldDefinition::factory()->create();

    $this->deleteJson("/api/field-definitions/{$field->id}")->assertNoContent();
    expect(FieldDefinition::query()->count())->toBe(0);
});
