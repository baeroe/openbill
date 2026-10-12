<?php

use App\Enums\UserRole;
use App\Models\User;
use App\Models\UserInvitation;
use Database\Seeders\E2eUserSeeder;
use Illuminate\Support\Facades\Hash;

it('creates the login of the Playwright tests once', function () {
    $this->seed(E2eUserSeeder::class);
    $this->seed(E2eUserSeeder::class);

    $user = User::query()->where('email', E2eUserSeeder::EMAIL)->sole();
    expect(Hash::check(E2eUserSeeder::PASSWORD, $user->password))->toBeTrue()
        ->and($user->role)->toBe(UserRole::Owner)
        ->and($user->name)->toBe('Erik Ende');
});

it('refuses to run in production', function () {
    app()->detectEnvironment(fn () => 'production');

    (new E2eUserSeeder)->run();
})->throws(RuntimeException::class);

it('removes the accounts and invitations the Playwright tests left behind (review #10)', function () {
    $invited = User::factory()->create(['email' => 'e2e.nina.abc@example.com', 'disabled_at' => now()]);
    $kept = User::factory()->create(['email' => 'nina@example.com']);
    UserInvitation::factory()->create(['email' => 'e2e.nina.def@example.com']);

    $this->seed(E2eUserSeeder::class);

    expect(User::query()->find($invited->id))->toBeNull()
        ->and(User::query()->find($kept->id))->not->toBeNull()
        ->and(UserInvitation::query()->where('email', 'like', 'e2e.%')->count())->toBe(0);
});
