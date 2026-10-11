<?php

use App\Enums\ActorType;
use App\Enums\DocumentFileKind;
use App\Models\Document;
use App\Models\DocumentEvent;
use App\Support\SignedDownloads;

/*
 * Acceptance of phase 4: the main flow of spec section 1 completely over HTTP with one token –
 * offer with groups → finalize → accepted → invoice → e-invoice check green → finalize (PDF/A-3 with XML
 * in the archive) → paid → cancellation.
 */
it('runs the main flow of the spec over the REST API', function () {
    $year = now()->format('Y');
    $this->withToken(apiToken(['api:read', 'api:write']));

    // settings: sender for EN 16931, e-invoice profile for invoices and cancellations
    $this->patchJson('/api/organization', [
        'name' => 'Studio Nordlicht', 'street' => 'Speicherstraße 12', 'zip' => '20457', 'city' => 'Hamburg', 'country' => 'DE',
        'vat_id' => 'DE123456789', 'iban' => 'DE02120300000000202051', 'email' => 'hallo@nordlicht.example',
    ])->assertOk();
    foreach (['invoice', 'cancellation'] as $type) {
        $this->patchJson("/api/document-types/{$type}", ['profile' => 'en16931'])->assertOk()->assertJsonPath('profile', 'en16931');
    }

    $hour = collect($this->getJson('/api/units')->assertOk()->json())->firstWhere('code', 'HUR')['id'];
    $vat = collect($this->getJson('/api/tax-rates')->assertOk()->json())->firstWhere('percent', '19.00')['id'];
    $row = fn (string $title, string $quantity, string $price, string $kind = 'item'): array => [
        'kind' => $kind, 'title' => $title, 'description' => '', 'quantity' => $quantity, 'unit_price' => $price,
        'unit_id' => $hour, 'tax_rate_id' => $vat,
    ];

    $customer = $this->postJson('/api/customers', [
        'name' => 'Hafenkontor Lindqvist GmbH', 'street' => 'Kaistraße 4', 'zip' => '20457', 'city' => 'Hamburg', 'country' => 'DE',
        'email' => 'einkauf@hafenkontor.example',
        'contacts' => [['first_name' => 'Mira', 'last_name' => 'Lindqvist', 'email' => 'mira@hafenkontor.example']],
    ])->assertCreated()->json();

    // offer with groups and an optional position
    $offer = $this->postJson('/api/documents', [
        'type' => 'offer',
        'customer_id' => $customer['id'],
        'groups' => [
            ['title' => 'Workshop', 'positions' => [$row('Discovery workshop', '8', '120'), $row('Concept', '12', '110')]],
            ['title' => 'Options', 'positions' => [$row('Hosting', '12', '49', 'optional')]],
        ],
    ])->assertCreated()->assertJsonPath('status', 'draft')->json();
    expect($offer['totals']['net'])->toBe('2280.00')
        ->and($offer['totals']['optional_net'])->toBe('588.00')
        ->and($offer['contact_id'])->toBe($customer['contacts'][0]['id']);

    $this->postJson("/api/documents/{$offer['id']}/finalize")
        ->assertOk()
        ->assertJsonPath('status', 'open')
        ->assertJsonPath('number', "Q-{$year}-0001");
    $this->postJson("/api/documents/{$offer['id']}/status", ['status' => 'accepted'])->assertOk()->assertJsonPath('status', 'accepted');

    // invoice from the offer; the e-invoice check is green once service and due date are set
    $invoice = $this->postJson("/api/documents/{$offer['id']}/convert", ['type' => 'invoice'])
        ->assertOk()
        ->assertJsonPath('type', 'invoice')
        ->assertJsonPath('source_id', $offer['id'])
        ->json();
    $invoice = $this->patchJson("/api/documents/{$invoice['id']}", [
        'service_date' => now()->toDateString(),
        'due_date' => now()->addDays(14)->toDateString(),
    ])->assertOk()->json();
    expect($invoice['issues'])->toBe([])
        ->and($invoice['totals']['gross'])->toBe('2713.20');

    $preview = $this->postJson('/api/render', ['document_id' => $invoice['id']])->assertOk()->json();
    expect($preview['errors'])->toBe([])
        ->and($preview['issues'])->toBe([])
        ->and($preview['body'])->toContain('Hafenkontor Lindqvist GmbH');

    $done = $this->postJson("/api/documents/{$invoice['id']}/finalize")
        ->assertOk()
        ->assertJsonPath('status', 'open')
        ->assertJsonPath('number', "INV-{$year}-0001")
        ->json();
    expect(Document::query()->findOrFail($done['id'])->files()->pluck('kind')->all())
        ->toEqualCanonicalizing([DocumentFileKind::Pdf, DocumentFileKind::Xml]);

    expect($this->get("/api/documents/{$done['id']}/pdf")->assertOk()->assertHeader('Content-Type', 'application/pdf')->getContent())
        ->toStartWith('%PDF');
    expect($this->get("/api/documents/{$done['id']}/xml")->assertOk()->getContent())->toContain("INV-{$year}-0001");

    $this->postJson("/api/documents/{$done['id']}/status", ['status' => 'paid'])->assertOk()->assertJsonPath('status', 'paid');

    // cancellation
    $cancellation = $this->postJson("/api/documents/{$done['id']}/cancel")
        ->assertOk()
        ->assertJsonPath('type', 'cancellation')
        ->json();
    $this->postJson("/api/documents/{$cancellation['id']}/finalize")
        ->assertOk()
        ->assertJsonPath('status', 'closed')
        ->assertJsonPath('number', "CN-{$year}-0001");
    $this->getJson("/api/documents/{$done['id']}")
        ->assertJsonPath('status', 'cancelled')
        ->assertJsonPath('cancelled_by_id', $cancellation['id']);

    // the signed link the MCP server hands out works without a token
    $link = app(SignedDownloads::class)->link(Document::query()->findOrFail($done['id']), DocumentFileKind::Pdf);
    $this->flushHeaders()->get($link['url'])->assertOk()->assertHeader('Content-Type', 'application/pdf');

    // every step is logged for the token
    expect(DocumentEvent::query()->whereIn('document_id', [$offer['id'], $done['id'], $cancellation['id']])->pluck('actor_type')->unique()->values()->all())
        ->toBe([ActorType::Token]);
});
