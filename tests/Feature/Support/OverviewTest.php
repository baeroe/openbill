<?php

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Customer;
use App\Models\Document;
use App\Support\Overview;
use Carbon\CarbonImmutable;

beforeEach(fn () => $this->travelTo('2026-10-11 10:00:00'));

$today = fn (): CarbonImmutable => CarbonImmutable::parse('2026-10-11');

it('is empty on a fresh installation (review focus)', function () use ($today) {
    $overview = Overview::build($today());

    expect($overview['figures']['open'])->toBe(['gross' => '0.00', 'count' => 0])
        ->and($overview['figures']['paid_year'])->toBe(['gross' => '0.00', 'count' => 0])
        ->and($overview['attention'])->toBe([])
        ->and($overview['attention_count'])->toBe(0)
        ->and($overview['recent'])->toBe([]);
});

it('sums open, overdue, offered and paid amounts exactly', function () use ($today) {
    Document::factory()->finalized()->create(['gross_total' => '100.10', 'due_date' => '2026-10-20']);
    Document::factory()->finalized()->create(['gross_total' => '0.20', 'due_date' => '2026-10-01']);
    Document::factory()->type(DocumentType::Offer)->finalized()->create(['gross_total' => '500.00', 'valid_until' => '2026-11-30']);
    Document::factory()->finalized()->create(['status' => DocumentStatus::Paid, 'paid_at' => '2026-10-05 12:00:00', 'gross_total' => '40.00']);
    Document::factory()->finalized()->create(['status' => DocumentStatus::Paid, 'paid_at' => '2026-02-01 12:00:00', 'gross_total' => '60.00']);
    Document::factory()->finalized()->create(['status' => DocumentStatus::Paid, 'paid_at' => '2025-12-31 12:00:00', 'gross_total' => '999.00']);

    $figures = Overview::build($today())['figures'];

    expect($figures['open'])->toBe(['gross' => '100.30', 'count' => 2])
        ->and($figures['overdue'])->toBe(['gross' => '0.20', 'count' => 1])
        ->and($figures['offers'])->toBe(['gross' => '500.00', 'count' => 1])
        ->and($figures['paid_month'])->toBe(['gross' => '40.00', 'count' => 1])
        ->and($figures['paid_year'])->toBe(['gross' => '100.00', 'count' => 2]);
});

it('lists overdue invoices, then expiring offers, then drafts', function () use ($today) {
    $draft = Document::factory()->create(['updated_at' => '2026-10-09 08:00:00']);
    $expiring = Document::factory()->type(DocumentType::Offer)->finalized()->create(['valid_until' => '2026-10-15']);
    $expired = Document::factory()->type(DocumentType::Offer)->finalized()->create(['valid_until' => '2026-10-02']);
    Document::factory()->type(DocumentType::Offer)->finalized()->create(['valid_until' => '2026-12-01']);
    $late = Document::factory()->finalized()->create(['due_date' => '2026-10-08']);

    $attention = Overview::build($today())['attention'];

    expect(array_column($attention, 'id'))->toBe([$late->id, $expired->id, $expiring->id, $draft->id])
        ->and(array_column($attention, 'reason'))->toBe(['overdue', 'offer_expired', 'offer_expiring', 'draft'])
        ->and(array_column($attention, 'reason_date'))->toBe(['2026-10-08', '2026-10-02', '2026-10-15', '2026-10-09'])
        ->and($attention[0]['is_overdue'])->toBeTrue();
});

it('shows at most eight items but counts all', function () use ($today) {
    Document::factory()->count(10)->create();

    $overview = Overview::build($today());

    expect($overview['attention'])->toHaveCount(8)
        ->and($overview['attention_count'])->toBe(10);
});

it('lists the six documents changed last', function () use ($today) {
    $documents = collect(range(1, 7))->map(fn (int $day) => Document::factory()->create(['updated_at' => "2026-10-0{$day} 09:00:00"]));

    $recent = Overview::build($today())['recent'];

    expect(array_column($recent, 'id'))->toBe($documents->reverse()->take(6)->pluck('id')->values()->all())
        ->and($recent[0])->toHaveKeys(['id', 'type', 'status', 'number', 'customer_name', 'gross_total', 'is_overdue']);
});

it('sums open invoices per customer for the customer list', function () use ($today) {
    $customer = Customer::factory()->create();
    Document::factory()->finalized()->create(['customer_id' => $customer->id, 'gross_total' => '10.05', 'due_date' => '2026-10-01']);
    Document::factory()->finalized()->create(['customer_id' => $customer->id, 'gross_total' => '20.00', 'due_date' => '2026-10-30']);
    Document::factory()->create(['customer_id' => $customer->id, 'gross_total' => '99.00']); // draft: not open

    expect(Overview::openByCustomer($today()))->toBe([$customer->id => ['gross' => '30.05', 'count' => 2, 'overdue' => 1]]);
});
