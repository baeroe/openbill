<?php

use App\Actions\CancelInvoice;
use App\Actions\ConvertDocument;
use App\Actions\DuplicateDocument;
use App\Actions\FinalizeDocument;
use App\Actions\SetDocumentStatus;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Document;
use App\Support\DocumentChain;

beforeEach(fn () => $this->travelTo('2026-10-11 10:00:00'));

function chainFinalize(Document $document): Document
{
    return app(FinalizeDocument::class)->handle(systemActor(), $document);
}

it('is empty for a document without source or successors', function () {
    expect(DocumentChain::for(draft()))->toBe([]);
});

it('lists the whole chain from the root, the same for every member, without duplicates', function () {
    $offer = chainFinalize(draft(DocumentType::Offer));
    $offer = app(SetDocumentStatus::class)->handle(systemActor(), $offer, DocumentStatus::Accepted);
    $confirmation = chainFinalize(app(ConvertDocument::class)->handle(systemActor(), $offer, DocumentType::Confirmation)->document);
    $invoice = chainFinalize(app(ConvertDocument::class)->handle(systemActor(), $confirmation, DocumentType::Invoice)->document);
    $cancellation = app(CancelInvoice::class)->handle(systemActor(), $invoice)->document;
    app(DuplicateDocument::class)->handle(systemActor(), $invoice);

    $expected = [
        ['id' => $offer->id, 'type' => 'offer', 'status' => 'accepted', 'number' => $offer->number],
        ['id' => $confirmation->id, 'type' => 'confirmation', 'status' => 'open', 'number' => $confirmation->number],
        ['id' => $invoice->id, 'type' => 'invoice', 'status' => 'open', 'number' => $invoice->number],
        ['id' => $cancellation->id, 'type' => 'cancellation', 'status' => 'draft', 'number' => null],
    ];

    foreach ([$offer, $confirmation, $invoice, $cancellation] as $member) {
        expect(DocumentChain::for($member->fresh()))->toBe($expected);
    }
});
