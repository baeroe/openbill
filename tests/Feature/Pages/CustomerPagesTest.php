<?php

use App\Models\Customer;
use App\Models\Document;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => $this->travelTo('2026-10-11 10:00:00'));

it('renders the customer list with the open amounts per customer', function () {
    $customer = Customer::factory()->create();
    Document::factory()->finalized()->create(['customer_id' => $customer->id, 'gross_total' => '119.00', 'due_date' => '2026-10-01']);

    $this->actingAs(User::factory()->create())->get('/en/customers')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('customers/index')
            ->where("open_by_customer.{$customer->id}", ['gross' => '119.00', 'count' => 1, 'overdue' => 1]));
});

it('renders an empty customer list on a fresh installation', function () {
    $this->actingAs(User::factory()->create())->get('/de/customers')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('customers/index')->where('open_by_customer', []));
});
