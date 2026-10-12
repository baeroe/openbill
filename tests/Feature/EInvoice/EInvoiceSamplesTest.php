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
 * The e-invoice cases the EN 16931 Schematron check runs on (scripts/validate-einvoice.sh, CI job "einvoice").
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
        'third_country_services' => function () {
            Organization::current()->forceFill(['registration_id' => 'HRB 000000'])->save();

            return finalizedInvoice([itemRow('Workshop', '10', '95')], [], ['name' => 'Bergbahn Demo AG', 'street' => 'Talweg 3', 'zip' => '3920', 'city' => 'Zermatt', 'country' => 'CH', 'vat_id' => 'CHE123456789', 'tax_treatment' => TaxTreatment::ThirdCountry, 'supply_type' => 'services']);
        },
        'discount' => fn () => finalizedInvoice([itemRow('Workshop', '10', '95'), itemRow('Stammkundenrabatt', '1', '-100')]),
        'discount_cancellation' => fn () => app(FinalizeDocument::class)->handle(systemActor(), app(CancelInvoice::class)->handle(systemActor(), finalizedInvoice([itemRow('Workshop', '10', '95'), itemRow('Stammkundenrabatt', '1', '-100')]))->document),
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

it('leaves out the VAT IDs for services to third-country customers (BR-O-02)', function () {
    $xml = archivedXml(eInvoiceCases()['third_country_services']());

    expect($xml)->toContain('<ram:CategoryCode>O</ram:CategoryCode>')
        ->and($xml)->not->toContain('schemeID="VA"')
        ->and($xml)->not->toContain('RateApplicablePercent')
        ->and($xml)->toContain('HRB 000000');
});
