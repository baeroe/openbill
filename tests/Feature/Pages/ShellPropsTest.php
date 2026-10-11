<?php

use App\Models\Organization;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('shares the organization name with signed-in users', function () {
    Organization::query()->update(['name' => 'Studio Nordlicht']);

    $this->actingAs(User::factory()->create())->get('/en')
        ->assertInertia(fn (Assert $page) => $page->where('org.name', 'Studio Nordlicht'));
});

it('shares no organization with guests', function () {
    $this->get('/en/login')->assertInertia(fn (Assert $page) => $page->where('org', null));
});
