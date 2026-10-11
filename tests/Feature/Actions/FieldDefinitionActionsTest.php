<?php

use App\Actions\DeleteFieldDefinition;
use App\Actions\SaveFieldDefinition;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Models\FieldDefinition;
use Illuminate\Validation\ValidationException;

/** @return array<string, list<string>> */
function fieldDefinitionErrors(array $input, ?FieldDefinition $definition = null): array
{
    try {
        app(SaveFieldDefinition::class)->handle(systemActor(), $input, $definition);
    } catch (ValidationException $e) {
        return $e->errors();
    }

    return [];
}

it('creates a field and derives the key from the label', function () {
    $definition = app(SaveFieldDefinition::class)->handle(systemActor(), [
        'scope' => 'document', 'label' => 'Bestellnummer des Kunden', 'type' => 'text', 'doc_types' => ['confirmation', 'invoice'],
    ]);

    expect($definition->key)->toBe('bestellnummer_des_kunden')
        ->and($definition->scope)->toBe(FieldScope::Document)
        ->and($definition->doc_types)->toBe(['confirmation', 'invoice'])
        ->and($definition->sort)->toBe(1);
});

it('keeps scope and key after creation', function () {
    $definition = FieldDefinition::factory()->create(['key' => 'project_name', 'scope' => FieldScope::Document]);

    $saved = app(SaveFieldDefinition::class)->handle(systemActor(), [
        'scope' => 'customer', 'key' => 'renamed', 'label' => 'Project', 'type' => 'text', 'doc_types' => ['invoice'],
    ], $definition);

    expect($saved->key)->toBe('project_name')
        ->and($saved->scope)->toBe(FieldScope::Document)
        ->and($saved->label)->toBe('Project');
});

it('rejects reserved keys, duplicates, empty selects and missing doc types with paths', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'po_number']);

    expect(array_keys(fieldDefinitionErrors(['scope' => 'document', 'key' => 'number', 'label' => 'Nr', 'type' => 'text', 'doc_types' => ['invoice']])))->toBe(['key'])
        ->and(array_keys(fieldDefinitionErrors(['scope' => 'document', 'key' => 'po_number', 'label' => 'PO', 'type' => 'text', 'doc_types' => ['invoice']])))->toBe(['key'])
        ->and(array_keys(fieldDefinitionErrors(['scope' => 'document', 'label' => 'Priority', 'type' => 'select', 'options' => [' '], 'doc_types' => []])))->toBe(['options', 'doc_types'])
        ->and(array_keys(fieldDefinitionErrors(['scope' => 'planet', 'label' => 'X', 'type' => 'text'])))->toBe(['scope']);
});

it('drops doc types for levels without document types and normalizes the default value', function () {
    $definition = app(SaveFieldDefinition::class)->handle(systemActor(), [
        'scope' => 'customer', 'label' => 'Rabatt', 'type' => 'money', 'default_value' => '5', 'doc_types' => ['invoice'],
    ]);

    expect($definition->doc_types)->toBe([])
        ->and($definition->default_value)->toBe('5')
        ->and($definition->type)->toBe(FieldType::Money);
});

it('rejects a default value that does not fit the type', function () {
    expect(array_keys(fieldDefinitionErrors(['scope' => 'document', 'label' => 'Due', 'type' => 'date', 'default_value' => 'tomorrow', 'doc_types' => [DocumentType::Invoice->value]])))
        ->toBe(['default_value']);
});

it('deletes a field definition', function () {
    $definition = FieldDefinition::factory()->create();

    app(DeleteFieldDefinition::class)->handle(systemActor(), $definition);

    expect(FieldDefinition::query()->count())->toBe(0);
});
