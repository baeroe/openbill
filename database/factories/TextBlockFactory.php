<?php

namespace Database\Factories;

use App\Enums\TextBlockKind;
use App\Models\TextBlock;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TextBlock>
 */
class TextBlockFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => 'Block '.fake()->unique()->numberBetween(1, 999999),
            'kind' => TextBlockKind::Intro,
            'body' => 'Thank you for your request.',
        ];
    }
}
