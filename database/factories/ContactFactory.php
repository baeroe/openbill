<?php

namespace Database\Factories;

use App\Models\Contact;
use App\Models\Customer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Contact>
 */
class ContactFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'customer_id' => Customer::factory(),
            'salutation' => '',
            'first_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
            'position' => '',
            'email' => fake()->unique()->safeEmail(),
            'phone' => '',
            'is_default' => true,
            'custom' => [],
        ];
    }
}
