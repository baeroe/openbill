<?php

use App\Enums\UserRole;
use App\Models\User;

it('uses ULIDs as primary keys', function () {
    $user = User::factory()->create();

    expect($user->id)->toBeString()->toHaveLength(26);
});

it('gives new users the member role unless stated otherwise', function () {
    expect(User::factory()->create()->role)->toBe(UserRole::Member)
        ->and(User::factory()->owner()->create()->role)->toBe(UserRole::Owner);
});

it('never exposes the password hash when serialized', function () {
    expect(User::factory()->create()->toArray())->not->toHaveKeys(['password', 'remember_token']);
});
