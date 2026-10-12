<?php

use App\Actions\RenderPreview;
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

it('stores the customer kind, defaults to business and puts it into snapshot and Liquid context (review #5)', function () {
    $customer = Customer::factory()->create(['country' => 'CH', 'tax_treatment' => TaxTreatment::ThirdCountry]);
    expect($customer->fresh()->customer_kind->value)->toBe('business');

    $this->withToken(apiToken())->patchJson("/api/customers/{$customer->id}", ['customer_kind' => 'consumer'], ['Content-Type' => 'application/merge-patch+json'])
        ->assertOk()
        ->assertJsonPath('customer_kind', 'consumer');
    $this->withToken(apiToken())->patchJson("/api/customers/{$customer->id}", ['customer_kind' => 'robot'], ['Content-Type' => 'application/merge-patch+json'])
        ->assertUnprocessable()
        ->assertJsonPath('violations.0.path', 'customer_kind');
    $document = draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')], ['customer_id' => $customer->id]);

    $totals = app(DocumentInspector::class)->totals($document, app(DocumentInspector::class)->sources($document))->toArray();
    expect($totals['tax_breakdown'][0]['category'])->toBe('S')
        ->and($totals['legal_notes'])->toBe([]);
    $body = app(RenderPreview::class)->handle(systemActor(), ['document_id' => $document->id, 'template' => ['body' => '<i>{{ customer.kind }}</i>']])->render->body;
    expect($body)->toContain('<i>consumer</i>');
});
