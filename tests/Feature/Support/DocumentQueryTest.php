<?php

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Customer;
use App\Models\Document;
use App\Support\DocumentQuery;
use Illuminate\Validation\ValidationException;

beforeEach(function () {
    $this->today = '2026-10-11';
    $this->travelTo('2026-10-11 10:00:00');
    $this->fjord = Customer::factory()->create(['name' => 'Fjord Analytics AB']);
    $this->late = Document::factory()->finalized()->create(['customer_id' => $this->fjord->id, 'gross_total' => '119.00', 'due_date' => '2026-10-01']);
    // explicit customer: the factory picks a random demo name, which could be Fjord as well
    $this->onTime = Document::factory()->finalized()->create(['customer_id' => Customer::factory()->create(['name' => 'Hotel Alpenglück'])->id, 'gross_total' => '0.10', 'due_date' => '2026-10-20']);
    $this->offer = Document::factory()->type(DocumentType::Offer)->create(['customer_id' => $this->fjord->id, 'gross_total' => '50.00']);
});

it('filters overdue invoices like StatusMachine::isOverdue', function () {
    $ids = DocumentQuery::filtered(['status' => DocumentQuery::OVERDUE], $this->today)->pluck('id')->all();

    expect($ids)->toBe([$this->late->id]);
});

it('counts per type with the other filters applied', function () {
    expect(DocumentQuery::counts(['customer_id' => $this->fjord->id], $this->today))
        ->toBe(['all' => 2, 'offer' => 1, 'confirmation' => 0, 'invoice' => 1, 'cancellation' => 0]);
});

it('sums the gross totals as an exact string', function () {
    expect(DocumentQuery::summary(['type' => 'invoice'], $this->today))->toBe(['count' => 2, 'gross_total' => '119.10'])
        ->and(DocumentQuery::summary(['type' => 'cancellation'], $this->today))->toBe(['count' => 0, 'gross_total' => '0.00']);
});

it('searches number and customer name', function () {
    $ids = DocumentQuery::filtered(['q' => 'fjord'], $this->today)->pluck('id')->sort()->values()->all();

    expect($ids)->toBe(collect([$this->late->id, $this->offer->id])->sort()->values()->all());
});

it('drops invalid filters of a typed URL instead of failing (review focus)', function () {
    $query = ['type' => 'bogus', 'status' => ['x'], 'q' => '  ', 'customer_id' => str_repeat('x', 40), 'page' => '2'];

    expect(DocumentQuery::lenient($query))->toBe([])
        ->and(DocumentQuery::lenient(['type' => 'invoice', 'status' => 'overdue', 'q' => ' Fjord ']))
        ->toBe(['type' => 'invoice', 'status' => 'overdue', 'q' => 'Fjord']);
});

it('refuses invalid filters strictly for the API', function () {
    DocumentQuery::validate(['status' => 'bogus']);
})->throws(ValidationException::class);

it('lists overdue invoices over the API as well', function () {
    $this->withToken(apiToken())
        ->getJson('/api/documents?status=overdue')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.id', $this->late->id);
});

it('keeps the status filter of the API', function () {
    $this->withToken(apiToken())
        ->getJson('/api/documents?status='.DocumentStatus::Draft->value)
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.id', $this->offer->id);
});
