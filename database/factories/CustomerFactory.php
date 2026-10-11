<?php

namespace Database\Factories;

use App\Enums\TaxTreatment;
use App\Models\Customer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Customer>
 */
class CustomerFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'number' => 'K-'.fake()->unique()->numberBetween(2000, 999999),
            'name' => fake()->randomElement(['Hafenkontor Lindqvist GmbH', 'Fjord Analytics AB', 'Hotel Alpenglück', 'Kulturwerk Elbinsel e. V.']),
            'street' => 'Musterweg 1',
            'zip' => '20457',
            'city' => 'Hamburg',
            'country' => 'DE',
            'email' => fake()->unique()->safeEmail(),
            'vat_id' => '',
            'tax_treatment' => TaxTreatment::Domestic,
            'locale' => null,
            'custom' => [],
        ];
    }
}
