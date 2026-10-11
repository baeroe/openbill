<?php

namespace Database\Factories;

use App\Models\Template;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Template>
 */
class TemplateFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $slug = 'template-'.fake()->unique()->numberBetween(1, 999999);

        return [
            'name' => ucfirst($slug),
            'slug' => $slug,
            'version' => '1.0.0',
            'author' => 'openbill',
            'license' => 'MIT',
            'built_in' => false,
            'manifest' => [],
            'header' => '',
            'body' => '<h1>{{ document.number }}</h1>',
            'footer' => '',
            'css' => '',
        ];
    }
}
