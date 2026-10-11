<?php

use App\Actions\FinalizeDocument;
use App\Enums\DocumentType;
use App\Models\Customer;

beforeEach(fn () => $this->withToken(apiToken(['api:read'])));

it('lists documents in their short form and filters them', function () {
    $hafen = Customer::factory()->create(['name' => 'Hafenkontor Lindqvist GmbH']);
    $offer = draft(DocumentType::Offer, [], ['customer_id' => $hafen->id, 'date' => '2026-09-01']);
    $fjord = Customer::factory()->create(['name' => 'Fjord Analytics AB']);
    $invoice = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Invoice, [], ['customer_id' => $fjord->id, 'date' => '2026-10-02']));

    $this->getJson('/api/documents')
        ->assertOk()
        ->assertJsonCount(2)
        ->assertJsonPath('0.id', $invoice->id)
        ->assertJsonMissingPath('0.groups')
        ->assertJsonMissingPath('0.totals');

    $ids = fn (string $query): array => collect($this->getJson("/api/documents?{$query}")->assertOk()->json())->pluck('id')->all();
    expect($ids('type=offer'))->toBe([$offer->id])
        ->and($ids('status=open'))->toBe([$invoice->id])
        ->and($ids("customer_id={$hafen->id}"))->toBe([$offer->id])
        ->and($ids('q=lindqvist'))->toBe([$offer->id])
        ->and($ids('q='.urlencode((string) $invoice->number)))->toBe([$invoice->id])
        ->and($ids('date_from=2026-10-01'))->toBe([$invoice->id])
        ->and($ids('date_to=2026-09-30'))->toBe([$offer->id])
        ->and($ids('sort=date'))->toBe([$offer->id, $invoice->id]);

    $this->getJson('/api/documents?type=letter')->assertUnprocessable()->assertJsonPath('violations.0.path', 'type');
});

it('shows a draft with groups, totals as strings and its open compliance issues', function () {
    $document = draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')], ['customer_id' => null]);

    $response = $this->getJson("/api/documents/{$document->id}")
        ->assertOk()
        ->assertJsonPath('status', 'draft')
        ->assertJsonPath('is_locked', false)
        ->assertJsonPath('groups.0.positions.0.title', 'Workshop')
        ->assertJsonPath('groups.0.positions.0.quantity', '10.0000')
        ->assertJsonPath('groups.0.positions.0.unit_price', '95.0000')
        ->assertJsonPath('totals.net', '950.00')
        ->assertJsonPath('totals.gross', '1130.50')
        ->assertJsonPath('net_total', '950.00')
        ->assertJsonPath('dropped_fields', []);

    expect(collect($response->json('issues'))->pluck('code')->all())->toContain('customer_missing');
});

it('shows a finalized document with totals from its snapshot and no issues', function () {
    $document = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')]));

    $this->getJson("/api/documents/{$document->id}")
        ->assertOk()
        ->assertJsonPath('is_locked', true)
        ->assertJsonPath('number', $document->number)
        ->assertJsonPath('totals.gross', '1130.50')
        ->assertJsonPath('issues', []);
});

it('flags open invoices past their due date as overdue', function () {
    $invoice = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Invoice, [], [
        'date' => now()->subDays(30)->toDateString(),
        'due_date' => now()->subDay()->toDateString(),
    ]));

    $this->getJson("/api/documents/{$invoice->id}")->assertJsonPath('is_overdue', true);
});

it('pages through documents in JSON-LD', function () {
    foreach (range(1, 3) as $i) {
        draft();
    }

    $page = $this->get('/api/documents?itemsPerPage=2&page=2', ['Accept' => 'application/ld+json'])->assertOk()->json();

    expect($page['totalItems'])->toBe(3)
        ->and($page['member'])->toHaveCount(1)
        ->and($page['member'][0]['@id'])->toStartWith('/api/documents/');
});
