<?php

use App\Actions\CancelInvoice;
use App\Actions\FinalizeDocument;
use App\EInvoice\CiiBuilder;
use App\Enums\DocumentFileKind;
use App\Enums\DocumentType;
use App\Enums\TaxTreatment;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Models\Organization;
use Illuminate\Support\Facades\Storage;

/*
 * The e-invoice cases the EN 16931 checks run on (CEN Schematron and KoSIT validator, scripts/validate-einvoice.sh, CI
 * job "einvoice").
 * Every case goes through FinalizeDocument, so the XML is exactly what gets archived. With
 * EINVOICE_SAMPLES_DIR set, the XMLs are written there as <case>.xml.
 */

beforeEach(function () {
    completeOrganization();
    DocumentTypeSetting::query()->whereIn('type', ['invoice', 'cancellation'])->update(['profile' => 'en16931']);
});

function archivedXml(Document $document): string
{
    return (string) Storage::disk('archive')->get($document->files()->where('kind', DocumentFileKind::Xml)->sole()->path);
}

function finalizedInvoice(array $positions, array $input = [], array $customer = []): Document
{
    $buyer = Customer::factory()->create([
        'name' => 'Hafenkontor Lindqvist GmbH', 'street' => 'Am Sandtorkai 4', 'zip' => '20457', 'city' => 'Hamburg', 'country' => 'DE',
        'vat_id' => 'DE987654321', ...$customer,
    ]);

    return app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Invoice, $positions, [
        'customer_id' => $buyer->id, 'service_date' => now()->toDateString(), 'due_date' => now()->addDays(14)->toDateString(), ...$input,
    ]));
}

/**
 * Line discounts in percent (with rounding), as a fixed amount, of 100 %, and next to a discount line with a negative
 * price.
 *
 * @return list<array<string, mixed>>
 */
function lineDiscountRows(): array
{
    return [
        itemRow('Workshop', '10', '95', ['discount_type' => 'percent', 'discount_value' => '12.5']),
        itemRow('Lizenz', '3', '33.3333', ['discount_type' => 'amount', 'discount_value' => '50']),
        itemRow('Onboarding', '1', '250', ['discount_type' => 'percent', 'discount_value' => '100']),
        itemRow('Wartung', '1.5', '80', ['discount_type' => 'percent', 'discount_value' => '7.33']),
        itemRow('Stammkundenrabatt', '1', '-100', ['discount_type' => 'amount', 'discount_value' => '10']),
    ];
}

/** @return array<string, Closure(): Document> */
function eInvoiceCases(): array
{
    return [
        'invoice' => fn () => finalizedInvoice([itemRow('Workshop', '10', '95'), itemRow('Lizenz', '1.125', '12.3456')]),
        'cancellation' => fn () => app(FinalizeDocument::class)->handle(systemActor(), app(CancelInvoice::class)->handle(systemActor(), finalizedInvoice([itemRow('Workshop', '10', '95')]))->document),
        'small_business' => function () {
            Organization::current()->forceFill(['taxation_mode' => 'small_business', 'vat_id' => '', 'tax_number' => '12/345/67890', 'registration_id' => 'HRB 000000'])->save();

            return finalizedInvoice([itemRow('Workshop', '10', '95')]);
        },
        'small_business_third_country' => function () {
            Organization::current()->forceFill(['taxation_mode' => 'small_business', 'vat_id' => '', 'tax_number' => '12/345/67890', 'registration_id' => 'HRB 000000'])->save();

            return finalizedInvoice([itemRow('Workshop', '10', '95')], [], ['name' => 'Bergbahn Demo AG', 'street' => 'Talweg 3', 'zip' => '3920', 'city' => 'Zermatt', 'country' => 'CH', 'vat_id' => '', 'tax_treatment' => TaxTreatment::ThirdCountry]);
        },
        'reverse_charge' => fn () => finalizedInvoice([itemRow('Workshop', '10', '95')], [], ['name' => 'Fjord Analytics AB', 'street' => 'Storgatan 1', 'zip' => '11122', 'city' => 'Stockholm', 'country' => 'SE', 'vat_id' => 'SE556677889901', 'tax_treatment' => TaxTreatment::EuReverseCharge]),
        'third_country' => fn () => finalizedInvoice([itemRow('Workshop', '10', '95')], [], ['name' => 'Bergbahn Demo AG', 'street' => 'Talweg 3', 'zip' => '3920', 'city' => 'Zermatt', 'country' => 'CH', 'vat_id' => '', 'tax_treatment' => TaxTreatment::ThirdCountry, 'supply_type' => 'goods']),
        'third_country_consumer_services' => fn () => finalizedInvoice([itemRow('Workshop', '10', '95')], [], ['name' => 'Lea Sommer', 'street' => 'Talweg 5', 'zip' => '3920', 'city' => 'Zermatt', 'country' => 'CH', 'vat_id' => '', 'tax_treatment' => TaxTreatment::ThirdCountry, 'supply_type' => 'services', 'customer_kind' => 'consumer']),
        'third_country_services' => function () {
            Organization::current()->forceFill(['registration_id' => 'HRB 000000'])->save();

            return finalizedInvoice([itemRow('Workshop', '10', '95')], [], ['name' => 'Bergbahn Demo AG', 'street' => 'Talweg 3', 'zip' => '3920', 'city' => 'Zermatt', 'country' => 'CH', 'vat_id' => 'CHE123456789', 'tax_treatment' => TaxTreatment::ThirdCountry, 'supply_type' => 'services']);
        },
        'discount' => fn () => finalizedInvoice([itemRow('Workshop', '10', '95'), itemRow('Stammkundenrabatt', '1', '-100')]),
        'discount_cancellation' => fn () => app(FinalizeDocument::class)->handle(systemActor(), app(CancelInvoice::class)->handle(systemActor(), finalizedInvoice([itemRow('Workshop', '10', '95'), itemRow('Stammkundenrabatt', '1', '-100')]))->document),
        'line_discount' => fn () => finalizedInvoice(lineDiscountRows()),
        'line_discount_cancellation' => fn () => app(FinalizeDocument::class)->handle(systemActor(), app(CancelInvoice::class)->handle(systemActor(), finalizedInvoice(lineDiscountRows()))->document),
        'line_discount_small_business' => function () {
            Organization::current()->forceFill(['taxation_mode' => 'small_business', 'vat_id' => '', 'tax_number' => '12/345/67890', 'registration_id' => 'HRB 000000'])->save();

            return finalizedInvoice([itemRow('Workshop', '4', '60', ['discount_type' => 'percent', 'discount_value' => '25']), itemRow('Lizenz', '1', '120', ['discount_type' => 'amount', 'discount_value' => '20'])]);
        },
    ];
}

it('archives a schema-valid e-invoice for every Schematron case', function (string $case) {
    $xml = archivedXml(eInvoiceCases()[$case]());

    expect(CiiBuilder::validate($xml))->toBe([]);

    $dir = getenv('EINVOICE_SAMPLES_DIR');
    if (is_string($dir) && $dir !== '') {
        is_dir($dir) || mkdir($dir, 0777, true);
        file_put_contents("{$dir}/{$case}.xml", $xml);
    }
})->with(array_keys(eInvoiceCases()));

it('carries line discounts as allowances with the discounted line amount (BG-27)', function () {
    $xml = archivedXml(eInvoiceCases()['line_discount']());

    // workshop: 950.00 − 12.5 % (118.75) = 831.25; licence: 100.00 − 50.00; onboarding: 250.00 − 100 %; maintenance:
    // 120.00 − 7.33 % (8.80) = 111.20; the negative discount line −100.00 + 10.00 = −90.00
    expect($xml)->toContain('<ram:LineTotalAmount>831.25</ram:LineTotalAmount>')
        ->toContain('<ram:LineTotalAmount>50.00</ram:LineTotalAmount>')
        ->toContain('<ram:LineTotalAmount>0.00</ram:LineTotalAmount>')
        ->toContain('<ram:LineTotalAmount>111.20</ram:LineTotalAmount>')
        ->toContain('<ram:LineTotalAmount>-90.00</ram:LineTotalAmount>')
        ->toContain('<ram:CalculationPercent>12.50</ram:CalculationPercent>')
        ->toContain('<ram:BasisAmount>950.00</ram:BasisAmount>')
        ->toContain('<ram:ActualAmount>118.75</ram:ActualAmount>')
        ->toContain('<ram:ActualAmount>-10.00</ram:ActualAmount>')
        ->toContain('<ram:ReasonCode>95</ram:ReasonCode>')
        ->and(substr_count($xml, '<ram:ChargeIndicator>'))->toBe(5)
        ->and($xml)->not->toContain('<ram:ChargeAmount>-')
        ->toContain('<ram:LineTotalAmount>902.45</ram:LineTotalAmount>');
});

it('leaves out the VAT IDs for services to third-country customers (BR-O-02)', function () {
    $xml = archivedXml(eInvoiceCases()['third_country_services']());

    expect($xml)->toContain('<ram:CategoryCode>O</ram:CategoryCode>')
        ->and($xml)->not->toContain('schemeID="VA"')
        ->and($xml)->not->toContain('RateApplicablePercent')
        ->and($xml)->toContain('HRB 000000');
});

it('taxes services to third-country consumers at the regular rate (review #5)', function () {
    $xml = archivedXml(eInvoiceCases()['third_country_consumer_services']());

    expect($xml)->toContain('<ram:CategoryCode>S</ram:CategoryCode>')
        ->and($xml)->not->toContain('<ram:CategoryCode>O</ram:CategoryCode>')
        ->and($xml)->toContain('schemeID="VA"');
});
