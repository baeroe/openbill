<?php

use App\Enums\UserRole;
use App\Models\User;
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
