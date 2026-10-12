<?php

use App\Enums\DocumentType;
use App\Enums\TaxTreatment;
use App\Models\Customer;
use App\Support\DocumentInspector;

it('defaults customers to services and renders third-country services as not taxable (O)', function () {
    $customer = Customer::factory()->create(['country' => 'CH', 'tax_treatment' => TaxTreatment::ThirdCountry]);
    expect($customer->fresh()->supply_type->value)->toBe('services');

    $document = draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')], ['customer_id' => $customer->id]);
    $totals = app(DocumentInspector::class)->totals($document, app(DocumentInspector::class)->sources($document))->toArray();

    expect($totals['tax_breakdown'][0]['category'])->toBe('O')
        ->and($totals['tax'])->toBe('0.00')
        ->and($totals['legal_notes'])->toContain(__('legal.third_country_services', [], $document->locale));
});

it('keeps exports of goods at G and saves the option over the API', function () {
    $customer = Customer::factory()->create(['country' => 'CH', 'tax_treatment' => TaxTreatment::ThirdCountry]);

    $this->withToken(apiToken())->patchJson("/api/customers/{$customer->id}", ['supply_type' => 'goods'], ['Content-Type' => 'application/merge-patch+json'])
        ->assertOk()
        ->assertJsonPath('supply_type', 'goods');
    $document = draft(DocumentType::Invoice, [itemRow('Maschine', '1', '1000')], ['customer_id' => $customer->id]);

    expect(app(DocumentInspector::class)->totals($document, app(DocumentInspector::class)->sources($document))->toArray()['tax_breakdown'][0]['category'])->toBe('G');
});
