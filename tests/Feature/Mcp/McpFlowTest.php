<?php

use App\Actions\UpdateDocumentType;
use App\Enums\ActorType;
use App\Enums\DocumentFileKind;
use App\Enums\DocumentType;
use App\Models\Document;
use App\Models\DocumentEvent;

/*
 * Acceptance of phase 8: the main flow of spec section 1 completely over HTTP JSON-RPC with one mcp token –
 * offer with groups → finalize → accepted → invoice → e-invoice check green → finalize (PDF/A-3 with XML in the
 * archive) → signed links → paid → cancellation.
 */
it('runs the main flow of the spec over MCP with one token', function () {
    $year = now()->format('Y');
    $token = apiToken(['mcp']);
    // settings, not part of the flow (the settings page or PATCH /api/document-types; spec 6 has no MCP tool for it)
    foreach ([DocumentType::Invoice, DocumentType::Cancellation] as $type) {
        app(UpdateDocumentType::class)->handle(systemActor(), $type, ['profile' => 'en16931']);
    }
    $ok = function (string $tool, array $arguments = []) use ($token): mixed {
        $call = mcpCall($token, $tool, $arguments);
        expect($call['error'])->toBeFalse("{$tool}: {$call['text']}");

        return $call['data'];
    };

    $ok('update-organization', [
        'name' => 'Studio Nordlicht', 'street' => 'Speicherstraße 12', 'zip' => '20457', 'city' => 'Hamburg', 'country' => 'DE',
        'vat_id' => 'DE123456789', 'iban' => 'DE02120300000000202051', 'email' => 'hallo@nordlicht.example',
    ]);
    expect(collect($ok('get-settings')['document_types'])->firstWhere('type', 'invoice')['profile'])->toBe('en16931');

    $master = $ok('list-tax-rates-and-units');
    $hour = collect($master['units'])->firstWhere('code', 'HUR')['id'];
    $vat = collect($master['tax_rates'])->firstWhere('percent', '19.00')['id'];
    $row = fn (string $title, string $quantity, string $price, string $kind = 'item'): array => [
        'kind' => $kind, 'title' => $title, 'description' => '', 'quantity' => $quantity, 'unit_price' => $price,
        'unit_id' => $hour, 'tax_rate_id' => $vat,
    ];

    $customer = $ok('create-customer', [
        'name' => 'Hafenkontor Lindqvist GmbH', 'street' => 'Kaistraße 4', 'zip' => '20457', 'city' => 'Hamburg', 'country' => 'DE',
        'email' => 'einkauf@hafenkontor.example',
        'contacts' => [['first_name' => 'Mira', 'last_name' => 'Lindqvist', 'email' => 'mira@hafenkontor.example']],
    ]);
    expect($ok('list-customers', ['q' => 'Hafenkontor'])['items'][0]['id'])->toBe($customer['id']);

    // offer with groups and an optional position
    $offer = $ok('create-document', [
        'type' => 'offer',
        'customer_id' => $customer['id'],
        'groups' => [
            ['title' => 'Workshop', 'positions' => [$row('Discovery workshop', '8', '120'), $row('Concept', '12', '110')]],
            ['title' => 'Options', 'positions' => [$row('Hosting', '12', '49', 'optional')]],
        ],
    ]);
    expect($offer['totals']['net'])->toBe('2280.00')
        ->and($offer['totals']['optional_net'])->toBe('588.00')
        ->and($offer['contact_id'])->toBe($customer['contacts'][0]['id']);

    expect($ok('finalize-document', ['id' => $offer['id']]))->toMatchArray(['status' => 'open', 'number' => "Q-{$year}-0001"]);
    expect($ok('set-document-status', ['id' => $offer['id'], 'status' => 'accepted'])['status'])->toBe('accepted');

    // invoice from the offer; the e-invoice check is green once service and due date are set
    $invoice = $ok('convert-document', ['id' => $offer['id'], 'type' => 'invoice']);
    expect($invoice)->toMatchArray(['type' => 'invoice', 'source_id' => $offer['id']]);
    $invoice = $ok('update-document', [
        'id' => $invoice['id'],
        'service_date' => now()->toDateString(),
        'due_date' => now()->addDays(14)->toDateString(),
    ]);
    expect($invoice['issues'])->toBe([])
        ->and($invoice['totals']['gross'])->toBe('2713.20')
        ->and($ok('get-document', ['id' => $invoice['id']])['issues'])->toBe([]);

    $preview = $ok('render-template-preview', ['document_id' => $invoice['id']]);
    expect($preview['errors'])->toBe([])
        ->and($preview['issues'])->toBe([])
        ->and($preview['page_count'])->toBe(1)
        ->and($preview['text_excerpt'])->toContain('Hafenkontor Lindqvist GmbH');

    $done = $ok('finalize-document', ['id' => $invoice['id']]);
    expect($done)->toMatchArray(['status' => 'open', 'number' => "INV-{$year}-0001"])
        ->and(Document::query()->findOrFail($done['id'])->files()->pluck('kind')->all())
        ->toEqualCanonicalizing([DocumentFileKind::Pdf, DocumentFileKind::Xml]);

    // signed links instead of files: they work without a token
    $links = $ok('get-document-pdf-url', ['id' => $done['id']]);
    expect($this->flushHeaders()->get($links['pdf']['url'])->assertOk()->assertHeader('Content-Type', 'application/pdf')->getContent())
        ->toStartWith('%PDF');
    expect($this->get($links['xml']['url'])->assertOk()->getContent())->toContain("INV-{$year}-0001");

    expect($ok('set-document-status', ['id' => $done['id'], 'status' => 'paid'])['status'])->toBe('paid');

    // cancellation
    $cancellation = $ok('cancel-invoice', ['id' => $done['id']]);
    expect($cancellation['type'])->toBe('cancellation');
    expect($ok('finalize-document', ['id' => $cancellation['id']]))->toMatchArray(['status' => 'closed', 'number' => "CN-{$year}-0001"]);
    expect($ok('get-document', ['id' => $done['id']]))->toMatchArray(['status' => 'cancelled', 'cancelled_by_id' => $cancellation['id']]);
    expect(collect($ok('list-documents', ['type' => 'cancellation'])['items'])->pluck('id')->all())->toBe([$cancellation['id']]);

    // every step is logged for the token
    expect(DocumentEvent::query()->whereIn('document_id', [$offer['id'], $done['id'], $cancellation['id']])->pluck('actor_type')->unique()->values()->all())
        ->toBe([ActorType::Token]);
});
