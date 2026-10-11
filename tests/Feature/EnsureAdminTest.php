<?php

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    config(['openbill.admin.email' => 'owner@example.com', 'openbill.admin.password' => 'secret-pass']);
});

it('creates the owner from ADMIN_EMAIL and ADMIN_PASSWORD', function () {
    $this->artisan('app:ensure-admin')->expectsOutputToContain('created')->assertSuccessful();

    $user = User::where('email', 'owner@example.com')->sole();
    expect($user->role)->toBe(UserRole::Owner)
        ->and(Hash::check('secret-pass', $user->password))->toBeTrue();
});

it('leaves an existing user untouched when it runs again on the next start', function () {
    $this->artisan('app:ensure-admin')->assertSuccessful();
    User::where('email', 'owner@example.com')->sole()->update(['password' => 'changed-in-the-ui']);

    $this->artisan('app:ensure-admin')->expectsOutputToContain('already exists')->assertSuccessful();

    expect(User::count())->toBe(1)
        ->and(Hash::check('changed-in-the-ui', User::sole()->password))->toBeTrue();
});

it('skips without failing when the variables are not set', function () {
    config(['openbill.admin.email' => null, 'openbill.admin.password' => '']);

    $this->artisan('app:ensure-admin')->expectsOutputToContain('not set')->assertSuccessful();

    expect(User::count())->toBe(0);
});

it('fails and creates nothing for invalid values', function (string $email, string $password) {
    config(['openbill.admin.email' => $email, 'openbill.admin.password' => $password]);

    $this->artisan('app:ensure-admin')->assertFailed();

    expect(User::count())->toBe(0);
})->with([
    'invalid email' => ['not-an-email', 'secret-pass'],
    'short password' => ['owner@example.com', 'short'],
]);
