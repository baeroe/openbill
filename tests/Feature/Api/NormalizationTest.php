<?php

use ApiPlatform\Metadata\Resource\Factory\ResourceMetadataCollectionFactoryInterface;
use App\Enums\FieldScope;
use App\Models\FieldDefinition;

/*
 * Every field of the documented shapes is always in the answer: no operation may drop null values
 * (API Platform's default) or turn empty objects into [] – also operations added later (phase 7+).
 */
it('keeps null values and empty objects in every operation of every resource', function () {
    $factory = app(ResourceMetadataCollectionFactoryInterface::class);
    $checked = [];

    foreach (glob(app_path('ApiResource/*Resource.php')) ?: [] as $file) {
        $class = 'App\\ApiResource\\'.basename($file, '.php');
        foreach ($factory->create($class) as $resource) {
            foreach ($resource->getOperations() ?? [] as $name => $operation) {
                $context = $operation->getNormalizationContext() ?? [];
                expect($context['skip_null_values'] ?? null)->toBeFalse("{$name}: skip_null_values")
                    ->and($context['preserve_empty_objects'] ?? null)->toBeTrue("{$name}: preserve_empty_objects");
                $checked[] = $name;
            }
        }
    }

    expect(count($checked))->toBeGreaterThan(40);
});

it('answers null fields of field definitions, document types and the organization', function () {
    $this->withToken(apiToken());
    $field = FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'note', 'default_value' => null]);

    expect($this->getJson("/api/field-definitions/{$field->id}")->assertOk()->json())->toHaveKey('default_value')
        ->and($this->getJson('/api/document-types/invoice')->assertOk()->json())->toHaveKeys(['template_id', 'default_intro_block_id', 'validity_days'])
        ->and($this->get('/api/organization', ['Accept' => 'application/ld+json'])->assertOk()->json())->toHaveKeys(['updated_at', 'locale']);
});
