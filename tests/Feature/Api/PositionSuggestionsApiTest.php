<?php

use App\Actions\CancelInvoice;
use App\Actions\FinalizeDocument;
use App\Enums\DocumentType;

it('suggests earlier positions, most used first, with the values of their latest use', function () {
    $this->withToken(apiToken(['api:read']));
    $invoice = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Invoice, [
        itemRow('Workshop', '2', '100'),
        itemRow('Hosting', '12', '49'),
        ['kind' => 'text', 'title' => 'Note', 'description' => ''],
    ]));
    draft(DocumentType::Offer, [itemRow('Workshop', '1', '120', ['description' => 'Half day'])]);
    app(CancelInvoice::class)->handle(systemActor(), $invoice); // cancellations never count

    $json = $this->getJson('/api/position-suggestions')->assertOk()->json();

    expect(collect($json)->pluck('title')->all())->toBe(['Workshop', 'Hosting'])
        ->and($json[0])->toMatchArray([
            'used_count' => 2,
            'unit_price' => '120.0000',
            'description' => 'Half day',
            'last_used' => now()->toDateString(),
            'unit_id' => hourUnitId(),
        ]);
    $this->getJson('/api/position-suggestions?q=HOST')->assertOk()->assertJsonCount(1)->assertJsonPath('0.title', 'Hosting');
    $this->getJson('/api/position-suggestions?limit=1')->assertOk()->assertJsonCount(1);
});

it('needs read access', function () {
    $this->withToken(apiToken(['templates:render']))->getJson('/api/position-suggestions')->assertForbidden();
});
