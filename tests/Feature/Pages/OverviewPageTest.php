<?php

use App\Models\Document;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => $this->travelTo('2026-10-11 10:00:00'));

it('renders the overview with the figures as strings', function () {
    Document::factory()->finalized()->create(['gross_total' => '119.00', 'due_date' => '2026-10-08']);

    $this->actingAs(User::factory()->create())->get('/en')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('overview')
            ->where('today', '2026-10-11')
            ->where('overview.figures.open', ['gross' => '119.00', 'count' => 1])
            ->where('overview.figures.overdue.count', 1)
            ->where('overview.attention.0.reason', 'overdue')
            ->where('overview.attention_count', 1)
            ->has('overview.recent', 1));
});

it('renders an empty overview on a fresh installation', function () {
    $this->actingAs(User::factory()->create())->get('/de')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('overview')
            ->where('overview.figures.paid_year.gross', '0.00')
            ->where('overview.attention', [])
            ->where('overview.recent', []));
});

it('sends guests to the login', function () {
    $this->get('/en')->assertRedirect('/en/login');
});
