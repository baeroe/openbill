<?php

namespace Database\Factories;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Customer;
use App\Models\Document;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Bare document without groups; tests that need positions use the helpers in tests/Pest.php.
 *
 * @extends Factory<Document>
 */
class DocumentFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'type' => DocumentType::Invoice,
            'status' => DocumentStatus::Draft,
            'date' => now()->toDateString(),
            'customer_id' => Customer::factory(),
            'locale' => 'en',
            'intro' => '',
            'closing' => '',
            'custom' => [],
            'net_total' => '0.00',
            'tax_total' => '0.00',
            'gross_total' => '0.00',
        ];
    }

    public function type(DocumentType $type): static
    {
        return $this->state(fn (array $attributes) => ['type' => $type]);
    }

    public function finalized(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => DocumentStatus::Open,
            'number' => 'TEST-'.fake()->unique()->numberBetween(1, 999999),
            'finalized_at' => now(),
        ]);
    }
}
