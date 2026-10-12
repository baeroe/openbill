<?php

namespace Database\Factories;

use App\Enums\UserRole;
use App\Models\UserInvitation;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<UserInvitation>
 */
class UserInvitationFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'email' => fake()->unique()->safeEmail(),
            'role' => UserRole::Member,
            'invited_by_id' => null,
            'expires_at' => now()->addDays(7),
            'accepted_at' => null,
        ];
    }
}
