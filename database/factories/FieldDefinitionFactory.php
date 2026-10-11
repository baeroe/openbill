<?php

namespace Database\Factories;

use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Models\FieldDefinition;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FieldDefinition>
 */
class FieldDefinitionFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'scope' => FieldScope::Document,
            'key' => 'field_'.fake()->unique()->numberBetween(1, 999999),
            'label' => 'Field',
            'type' => FieldType::Text,
            'required' => false,
            'default_value' => null,
            'help' => '',
            'options' => [],
            'doc_types' => ['offer', 'confirmation', 'invoice', 'cancellation'],
            'sort' => 0,
        ];
    }
}
