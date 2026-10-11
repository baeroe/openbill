<?php

use App\Models\Customer;
use App\Models\Document;
use App\Models\User;
use Illuminate\Support\Str;
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

it('renders the page of a new customer', function () {
    $this->actingAs(User::factory()->create())->get('/en/customers/new')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('customers/show')->where('customer_id', null));
});

it('renders the page of an existing customer only', function () {
    $customer = Customer::factory()->create();
    $this->actingAs(User::factory()->create());

    $this->get("/de/customers/{$customer->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('customers/show')->where('customer_id', $customer->id));
    $this->get('/de/customers/'.strtolower((string) Str::ulid()))->assertNotFound();
});

it('does not show deleted customers', function () {
    $customer = Customer::factory()->create();
    $customer->delete();

    $this->actingAs(User::factory()->create())->get("/en/customers/{$customer->id}")->assertNotFound();
});
