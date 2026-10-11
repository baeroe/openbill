<?php

use App\Actions\CancelInvoice;
use App\Actions\FinalizeDocument;
use App\Contracts\DocumentArchiver;
use App\EInvoice\CiiAmount;
use App\EInvoice\CiiBuilder;
use App\Enums\DocumentType;
use App\Enums\TaxTreatment;
use App\Exceptions\EInvoiceInvalidException;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Models\Organization;
use App\Support\DocumentInspector;
use App\Support\NullDocumentArchiver;
use App\Support\SnapshotBuilder;
use App\Support\Text;

beforeEach(function () {
    completeOrganization();
    DocumentTypeSetting::query()->whereIn('type', ['invoice', 'cancellation'])->update(['profile' => 'en16931']);
});

function ciiOf(Document $document, string $number = 'INV-2026-0007'): string
{
    $document->loadMissing('groups.positions');
    $document->number ??= $number;
    $sources = app(SnapshotBuilder::class)->build($document);

    return app(CiiBuilder::class)->build($document, $sources, app(DocumentInspector::class)->totals($document, $sources));
}

it('builds an EN 16931 invoice that is valid against the XSD', function () {
    $customer = Customer::factory()->create(['name' => 'Hafenkontor Lindqvist GmbH', 'number' => 'K-1001', 'vat_id' => 'DE987654321']);
    $document = draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95'), itemRow('Lizenz', '1.125', '12.3456')], [
        'customer_id' => $customer->id, 'date' => '2026-10-04', 'service_date' => '2026-09-30', 'due_date' => '2026-10-18',
    ]);

    $xml = ciiOf($document);

    expect(CiiBuilder::validate($xml))->toBe([])
        ->and($xml)->toContain('urn:cen.eu:en16931:2017')
        ->toContain('<ram:ID>INV-2026-0007</ram:ID>')
        ->toContain('<ram:TypeCode>380</ram:TypeCode>')
        ->toContain('20261004')
        ->toContain('Studio Nordlicht')
        ->toContain('DE123456789')
        ->toContain('Hafenkontor Lindqvist GmbH')
        ->toContain('DE987654321')
        ->toContain('DE02120300000000202051')
        ->toContain('<ram:ChargeAmount>12.3456</ram:ChargeAmount>')
        ->toContain('unitCode="HUR">1.1250</ram:BilledQuantity>')
        ->toContain('<ram:LineTotalAmount>950.00</ram:LineTotalAmount>')
        ->toContain('<ram:CategoryCode>S</ram:CategoryCode>')
        ->toContain('<ram:GrandTotalAmount>1147.03</ram:GrandTotalAmount>')
        ->toContain('<ram:DuePayableAmount>1147.03</ram:DuePayableAmount>')
        ->toContain('20260930')
        ->toContain('20261018');
});

it('marks small business invoices as exempt (E) with the legal note as reason', function () {
    Organization::current()->forceFill(['taxation_mode' => 'small_business'])->save();

    $xml = ciiOf(draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')], ['service_date' => '2026-09-30', 'due_date' => '2026-10-18']));

    expect(CiiBuilder::validate($xml))->toBe([])
        ->and($xml)->toContain('<ram:CategoryCode>E</ram:CategoryCode>')
        ->toContain('<ram:ExemptionReason>'.Text::t('legal.small_business').'</ram:ExemptionReason>')
        ->toContain('<ram:TaxTotalAmount currencyID="EUR">0.00</ram:TaxTotalAmount>');
});

it('marks EU reverse charge (AE) with the buyer VAT ID', function () {
    $customer = Customer::factory()->create(['name' => 'Fjord Analytics AB', 'country' => 'SE', 'vat_id' => 'SE556677889901', 'tax_treatment' => TaxTreatment::EuReverseCharge]);

    $xml = ciiOf(draft(DocumentType::Invoice, [itemRow()], ['customer_id' => $customer->id, 'service_date' => '2026-09-30', 'due_date' => '2026-10-18']));

    expect(CiiBuilder::validate($xml))->toBe([])
        ->and($xml)->toContain('<ram:CategoryCode>AE</ram:CategoryCode>')
        ->toContain('SE556677889901')
        ->toContain('<ram:ExemptionReason>');
});

it('turns a cancellation into a credit note (381) with positive amounts and the invoice reference', function () {
    app()->bind(DocumentArchiver::class, NullDocumentArchiver::class);
    $invoice = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')], ['service_date' => '2026-09-30', 'due_date' => '2026-10-18']));
    $cancellation = app(CancelInvoice::class)->handle(systemActor(), $invoice)->document;

    $xml = ciiOf($cancellation, 'CN-2026-0001');

    expect(CiiBuilder::validate($xml))->toBe([])
        ->and($xml)->toContain('<ram:TypeCode>381</ram:TypeCode>')
        ->toContain('<ram:IssuerAssignedID>'.$invoice->number.'</ram:IssuerAssignedID>')
        ->toContain('unitCode="HUR">10.0000</ram:BilledQuantity>')
        ->toContain('<ram:GrandTotalAmount>1130.50</ram:GrandTotalAmount>')
        ->not->toContain('>-');
});

it('reports XSD errors for broken XML and refuses to hand out an invalid e-invoice', function () {
    expect(CiiBuilder::validate('<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"/>'))->not->toBe([])
        ->and(CiiBuilder::validate('not xml'))->not->toBe([]);

    // a CII invoice needs at least one line item (IncludedSupplyChainTradeLineItem); compliance blocks this
    // case before finalizing, the builder must refuse it on its own as well
    $onlyText = draft(DocumentType::Invoice, [['kind' => 'text', 'title' => 'Nur Text', 'quantity' => '0', 'unit_price' => '0', 'unit_id' => null, 'tax_rate_id' => null, 'custom' => []]]);

    expect(fn () => ciiOf($onlyText))->toThrow(EInvoiceInvalidException::class);
});

it('converts amounts to float only when they survive the round trip', function () {
    expect(CiiAmount::of('1234567890123.45'))->toBe(1234567890123.45)
        ->and(CiiAmount::of('12.3456'))->toBe(12.3456)
        ->and(fn () => CiiAmount::of('12345678901234567.89'))->toThrow(LogicException::class);
});
