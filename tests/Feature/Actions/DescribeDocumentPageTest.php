<?php

use App\Actions\AllocateDocumentNumber;
use App\Actions\CancelInvoice;
use App\Actions\ConvertDocument;
use App\Actions\DescribeDocumentPage;
use App\Actions\FinalizeDocument;
use App\Actions\SetDocumentStatus;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\TaxationMode;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Models\Organization;

beforeEach(fn () => $this->travelTo('2026-10-11 10:00:00'));

function pageContext(Document $document): array
{
    return app(DescribeDocumentPage::class)->handle(systemActor(), $document->fresh());
}

function pageFinalize(Document $document): Document
{
    return app(FinalizeDocument::class)->handle(systemActor(), $document);
}

it('describes a draft: profile, number preview, finalize and delete, no status change or conversion', function () {
    $draft = draft(DocumentType::Invoice);

    $context = pageContext($draft);

    expect($context['profile'])->toBe('basic')
        ->and($context['next_number'])->toBe(app(AllocateDocumentNumber::class)->preview(DocumentType::Invoice, '2026-10-11'))
        ->and($context['small_business'])->toBeFalse()
        ->and($context['chain'])->toBe([])
        ->and($context['allowed'])->toBe(['finalize' => true, 'delete' => true, 'duplicate' => true, 'statuses' => [], 'conversions' => [], 'cancel' => false]);
});

it('takes the profile of the document type', function () {
    DocumentTypeSetting::query()->whereKey('invoice')->update(['profile' => 'en16931']);

    expect(pageContext(draft(DocumentType::Invoice))['profile'])->toBe('en16931');
});

it('offers the status changes and conversions the rules allow', function () {
    $offer = pageFinalize(draft(DocumentType::Offer));

    expect(pageContext($offer)['allowed'])->toBe(['finalize' => false, 'delete' => false, 'duplicate' => true, 'statuses' => ['accepted', 'rejected'], 'conversions' => [], 'cancel' => false])
        ->and(pageContext($offer)['next_number'])->toBeNull();

    $accepted = app(SetDocumentStatus::class)->handle(systemActor(), $offer, DocumentStatus::Accepted);
    expect(pageContext($accepted)['allowed'])->toBe(['finalize' => false, 'delete' => false, 'duplicate' => true, 'statuses' => [], 'conversions' => ['confirmation', 'invoice'], 'cancel' => false]);

    $invoice = pageFinalize(app(ConvertDocument::class)->handle(systemActor(), $accepted, DocumentType::Invoice)->document);
    expect(pageContext($invoice)['allowed'])->toBe(['finalize' => false, 'delete' => false, 'duplicate' => true, 'statuses' => ['paid'], 'conversions' => [], 'cancel' => true])
        ->and(array_column(pageContext($invoice)['chain'], 'type'))->toBe(['offer', 'invoice']);

    $cancellation = app(CancelInvoice::class)->handle(systemActor(), $invoice)->document;
    expect(pageContext($cancellation)['allowed'])->toBe(['finalize' => true, 'delete' => true, 'duplicate' => false, 'statuses' => [], 'conversions' => [], 'cancel' => false]);

    pageFinalize($cancellation);
    expect(pageContext($invoice)['allowed']['cancel'])->toBeFalse()
        ->and(pageContext($invoice)['allowed']['statuses'])->toBe([]);
});

it('reads small business from the organization for drafts and from the snapshot once finalized', function () {
    Organization::current()->forceFill(['taxation_mode' => TaxationMode::SmallBusiness])->save();
    $draft = draft(DocumentType::Invoice);
    expect(pageContext($draft)['small_business'])->toBeTrue();

    $invoice = pageFinalize($draft);
    Organization::current()->forceFill(['taxation_mode' => TaxationMode::Regular])->save();

    expect(pageContext($invoice)['small_business'])->toBeTrue()
        ->and(pageContext(draft(DocumentType::Invoice))['small_business'])->toBeFalse();
});

it('lists every template with the document types of its manifest', function () {
    $templates = pageContext(draft())['templates'];

    expect(array_column($templates, 'name'))->toBe(['Kante', 'Klar', 'Leise'])
        ->and($templates[1])->toMatchArray(['name' => 'Klar', 'document_types' => ['offer', 'confirmation', 'invoice', 'cancellation']])
        ->and($templates[1]['id'])->toBeString();
});
