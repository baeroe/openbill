<?php

use App\Actions\CancelInvoice;
use App\Actions\DescribeDocumentPage;
use App\Actions\FinalizeDocument;
use App\Contracts\DocumentArchiver;
use App\EInvoice\CiiBuilder;
use App\Enums\DocumentType;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Models\Organization;
use App\Models\TaxRate;
use App\Support\DocumentInspector;
use App\Support\NullDocumentArchiver;

/*
 * Review I1: a cancellation mirrors the tax of the invoice it cancels (its snapshot), never today's master data –
 * at conversion (draft totals) and at finalize (snapshot, totals, e-invoice).
 */
beforeEach(function () {
    app()->bind(DocumentArchiver::class, NullDocumentArchiver::class);
    completeOrganization();
    DocumentTypeSetting::query()->whereIn('type', ['invoice', 'cancellation'])->update(['profile' => 'en16931']);
});

function cancellationInvoice(): Document
{
    return app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')], [
        'service_date' => '2026-09-30', 'due_date' => '2026-10-18',
    ]));
}

/** The XML of a finalized document, built from its snapshot like the archiver does. */
function frozenCii(Document $document): string
{
    $document = $document->fresh(['groups.positions', 'snapshot']);
    $inspector = app(DocumentInspector::class);

    return app(CiiBuilder::class)->build($document, $inspector->sources($document), $inspector->totals($document));
}

it('keeps small-business exemption when the organization switched to regular taxation after the invoice', function () {
    Organization::current()->forceFill(['taxation_mode' => 'small_business'])->save();
    $invoice = cancellationInvoice();
    expect($invoice->gross_total)->toBe('950.00');

    Organization::current()->forceFill(['taxation_mode' => 'regular'])->save();
    $draft = app(CancelInvoice::class)->handle(systemActor(), $invoice)->document;

    expect($draft->gross_total)->toBe('-950.00')
        ->and($draft->tax_total)->toBe('0.00')
        ->and(app(DescribeDocumentPage::class)->handle(systemActor(), $draft)['small_business'])->toBeTrue();

    $cancellation = app(FinalizeDocument::class)->handle(systemActor(), $draft);
    $xml = frozenCii($cancellation);

    expect($cancellation->gross_total)->toBe('-950.00')
        ->and($cancellation->snapshot->data['org']['taxation_mode'])->toBe('small_business')
        ->and(app(DocumentInspector::class)->totals($cancellation->fresh())->legalNotes)->toHaveCount(1)
        ->and(CiiBuilder::validate($xml))->toBe([])
        ->and($xml)->toContain('<ram:CategoryCode>E</ram:CategoryCode>')
        ->not->toContain('<ram:CategoryCode>S</ram:CategoryCode>')
        ->toContain('<ram:GrandTotalAmount>950.00</ram:GrandTotalAmount>');
});

it('keeps domestic VAT when the customer was switched to reverse charge after the invoice', function () {
    $invoice = cancellationInvoice();
    expect($invoice->gross_total)->toBe('1130.50');

    Customer::query()->findOrFail($invoice->customer_id)->forceFill([
        'tax_treatment' => 'eu_reverse_charge', 'vat_id' => 'ATU12345678', 'country' => 'AT',
    ])->save();
    $draft = app(CancelInvoice::class)->handle(systemActor(), $invoice)->document;
    expect($draft->gross_total)->toBe('-1130.50');

    $cancellation = app(FinalizeDocument::class)->handle(systemActor(), $draft);
    $xml = frozenCii($cancellation);

    expect($cancellation->gross_total)->toBe('-1130.50')
        ->and($cancellation->snapshot->data['customer']['tax_treatment'])->toBe('domestic')
        ->and(app(DocumentInspector::class)->totals($cancellation->fresh())->legalNotes)->toBe([])
        ->and(CiiBuilder::validate($xml))->toBe([])
        ->and($xml)->toContain('<ram:CategoryCode>S</ram:CategoryCode>')
        ->toContain('<ram:RateApplicablePercent>19.00</ram:RateApplicablePercent>')
        ->not->toContain('<ram:CategoryCode>AE</ram:CategoryCode>');
});

it('keeps the percent of the invoice when the tax rate was edited afterwards', function () {
    $invoice = cancellationInvoice();
    TaxRate::query()->findOrFail(vatRateId())->forceFill(['percent' => '16.00'])->save();

    $draft = app(CancelInvoice::class)->handle(systemActor(), $invoice)->document;
    expect($draft->gross_total)->toBe('-1130.50');

    $cancellation = app(FinalizeDocument::class)->handle(systemActor(), $draft);
    $rate = collect($cancellation->snapshot->data['tax_rates'])->firstWhere('id', $invoice->groups[0]->positions[0]->tax_rate_id);

    expect($cancellation->gross_total)->toBe('-1130.50')
        ->and($rate['percent'])->toBe('19.00')
        ->and(frozenCii($cancellation))->toContain('<ram:RateApplicablePercent>19.00</ram:RateApplicablePercent>');
});

it('uses live rates for positions with a rate the invoice did not know', function () {
    $invoice = cancellationInvoice();
    $newRate = TaxRate::query()->create(['label' => 'New 9 %', 'percent' => '9.00', 'category' => 'S', 'sort' => 99]);
    $draft = app(CancelInvoice::class)->handle(systemActor(), $invoice)->document;

    $sources = app(DocumentInspector::class)->sources($draft);

    expect(collect($sources['tax_rates'])->firstWhere('id', $newRate->id)['percent'])->toBe('9.00');
});
