<?php

use App\Enums\DocumentType;
use App\Models\Customer;
use App\Models\Document;
use App\Models\User;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => $this->travelTo('2026-10-11 10:00:00'));

it('renders the list with normalized filters, counts per type and the sum', function () {
    $fjord = Customer::factory()->create(['name' => 'Fjord Analytics AB']);
    Document::factory()->finalized()->create(['customer_id' => $fjord->id, 'gross_total' => '119.00', 'due_date' => '2026-10-01']);
    Document::factory()->finalized()->create(['customer_id' => $fjord->id, 'gross_total' => '10.00', 'due_date' => '2026-10-30']);
    Document::factory()->type(DocumentType::Offer)->create(['customer_id' => $fjord->id, 'gross_total' => '50.00']);

    $this->actingAs(User::factory()->create())
        ->get("/en/documents?type=invoice&customer_id={$fjord->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('documents/index')
            ->where('filters', ['type' => 'invoice', 'status' => null, 'customer_id' => $fjord->id, 'q' => null])
            ->where('counts', ['all' => 3, 'offer' => 1, 'confirmation' => 0, 'invoice' => 2, 'cancellation' => 0])
            ->where('summary', ['count' => 2, 'gross_total' => '129.00'])
            ->where('customers', [['id' => $fjord->id, 'name' => 'Fjord Analytics AB']]));
});

it('filters overdue invoices', function () {
    Document::factory()->finalized()->create(['due_date' => '2026-10-01']);
    Document::factory()->finalized()->create(['due_date' => '2026-10-30']);

    $this->actingAs(User::factory()->create())
        ->get('/de/documents?status=overdue')
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.status', 'overdue')
            ->where('counts.invoice', 1)
            ->where('summary.count', 1));
});

it('ignores invalid filters of a typed URL (review focus)', function () {
    Document::factory()->create();

    $this->actingAs(User::factory()->create())
        ->get('/en/documents?type=bogus&status[]=x&q=%20%20&customer_id='.str_repeat('x', 40))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters', ['type' => null, 'status' => null, 'customer_id' => null, 'q' => null])
            ->where('counts.all', 1)
            ->where('summary.count', 1));
});

it('renders the page of an existing document only', function () {
    $document = Document::factory()->create();
    $this->actingAs(User::factory()->create());

    $this->get("/en/documents/{$document->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('documents/show')->where('document_id', $document->id));
    $this->get('/en/documents/'.strtolower((string) Str::ulid()))->assertNotFound();
    $this->get('/en/documents/not-an-id')->assertNotFound();
});

it('sends guests to the login', function () {
    $this->get('/en/documents')->assertRedirect('/en/login');
});
