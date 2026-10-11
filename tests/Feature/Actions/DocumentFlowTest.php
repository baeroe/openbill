<?php

use App\Actions\CancelInvoice;
use App\Actions\ConvertDocument;
use App\Actions\CreateDocument;
use App\Actions\DuplicateDocument;
use App\Actions\FinalizeDocument;
use App\Actions\SetDocumentStatus;
use App\Actions\UpdateDraft;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Enums\FieldScope;
use App\Exceptions\ActionNotAllowedException;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Models\FieldDefinition;
use App\Support\DocumentInspector;

function finalized(Document $document): Document
{
    return app(FinalizeDocument::class)->handle(systemActor(), $document);
}

it('sets statuses only along the allowed transitions and stamps paid_at', function () {
    $invoice = finalized(draft());

    expect(fn () => app(SetDocumentStatus::class)->handle(systemActor(), $invoice, DocumentStatus::Accepted))->toThrow(ActionNotAllowedException::class)
        ->and(fn () => app(SetDocumentStatus::class)->handle(systemActor(), draft(), DocumentStatus::Open))->toThrow(ActionNotAllowedException::class);

    $paid = app(SetDocumentStatus::class)->handle(systemActor(), $invoice, DocumentStatus::Paid);

    expect($paid->status)->toBe(DocumentStatus::Paid)
        ->and($paid->paid_at)->not->toBeNull()
        ->and($paid->events()->pluck('payload')->last())->toBe(['from' => 'open', 'to' => 'paid']);
});

it('converts an accepted offer into an invoice and reports dropped fields', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'project_name', 'doc_types' => ['offer', 'invoice']]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'response_time', 'doc_types' => ['offer']]);
    $offer = finalized(draft(DocumentType::Offer, [itemRow('Workshop', '1', '890'), itemRow('Hosting', '12', '49', ['kind' => 'optional'])], [
        'custom' => ['project_name' => 'Relaunch', 'response_time' => '48h'],
    ]));

    expect(fn () => app(ConvertDocument::class)->handle(systemActor(), $offer, DocumentType::Invoice))->toThrow(ActionNotAllowedException::class);

    $offer = app(SetDocumentStatus::class)->handle(systemActor(), $offer, DocumentStatus::Accepted);
    $result = app(ConvertDocument::class)->handle(systemActor(), $offer, DocumentType::Invoice);
    $invoice = $result->document;

    expect($invoice->type)->toBe(DocumentType::Invoice)
        ->and($invoice->status)->toBe(DocumentStatus::Draft)
        ->and($invoice->source_id)->toBe($offer->id)
        ->and($invoice->custom)->toBe(['project_name' => 'Relaunch'])
        ->and($result->droppedFields)->toBe(['document.response_time'])
        ->and($invoice->groups[0]->positions->pluck('title')->all())->toBe(['Workshop'])
        ->and($invoice->due_date?->toDateString())->toBe(now()->addDays(14)->toDateString())
        ->and($invoice->gross_total)->toBe('1059.10')
        ->and($invoice->events()->pluck('action')->all())->toBe([EventAction::ConvertedFrom])
        ->and($offer->events()->pluck('action')->last())->toBe(EventAction::Converted);
});

it('creates one cancellation per invoice with negated quantities', function () {
    $invoice = finalized(draft(DocumentType::Invoice, [itemRow('Consulting', '10', '95')]));

    $first = app(CancelInvoice::class)->handle(systemActor(), $invoice)->document;
    $second = app(CancelInvoice::class)->handle(systemActor(), $invoice)->document;

    expect($second->id)->toBe($first->id)
        ->and($first->type)->toBe(DocumentType::Cancellation)
        ->and($first->groups[0]->positions[0]->quantity)->toBe('-10.0000')
        ->and($first->gross_total)->toBe('-1130.50')
        ->and($invoice->fresh()->status)->toBe(DocumentStatus::Open);
});

it('closes the cancellation and marks the invoice as cancelled when finalizing', function () {
    $invoice = finalized(draft());
    $cancellation = finalized(app(CancelInvoice::class)->handle(systemActor(), $invoice)->document);

    expect($cancellation->status)->toBe(DocumentStatus::Closed)
        ->and($cancellation->number)->toStartWith('CN-')
        ->and($invoice->fresh()->status)->toBe(DocumentStatus::Cancelled)
        ->and($invoice->fresh()->cancelled_by_id)->toBe($cancellation->id)
        ->and($invoice->events()->pluck('action')->last())->toBe(EventAction::Cancelled)
        ->and(fn () => app(CancelInvoice::class)->handle(systemActor(), $invoice->fresh()))->toThrow(ActionNotAllowedException::class);
});

it('refuses to cancel offers and drafts', function () {
    expect(fn () => app(CancelInvoice::class)->handle(systemActor(), draft()))->toThrow(ActionNotAllowedException::class)
        ->and(fn () => app(CancelInvoice::class)->handle(systemActor(), finalized(draft(DocumentType::Offer))))->toThrow(ActionNotAllowedException::class);
});

it('duplicates a document as a fresh draft with new ids', function () {
    $source = finalized(draft(DocumentType::Invoice, [itemRow('Consulting', '10', '95')], ['intro' => 'Hello']));

    $copy = app(DuplicateDocument::class)->handle(systemActor(), $source);

    expect($copy->id)->not->toBe($source->id)
        ->and($copy->status)->toBe(DocumentStatus::Draft)
        ->and($copy->number)->toBeNull()
        ->and($copy->finalized_at)->toBeNull()
        ->and($copy->source_id)->toBeNull()
        ->and($copy->intro)->toBe('Hello')
        ->and($copy->date->toDateString())->toBe(now()->toDateString())
        ->and($copy->groups[0]->positions[0]->id)->not->toBe($source->groups[0]->positions[0]->id)
        ->and($copy->gross_total)->toBe('1130.50')
        ->and($copy->events()->pluck('action')->all())->toBe([EventAction::Duplicated]);
});

it('refuses to duplicate a cancellation', function () {
    $cancellation = app(CancelInvoice::class)->handle(systemActor(), finalized(draft()))->document;

    expect(fn () => app(DuplicateDocument::class)->handle(systemActor(), $cancellation))->toThrow(ActionNotAllowedException::class);
});

it('runs the main flow: offer → accepted → invoice → e-invoice check → paid → cancellation', function () {
    completeOrganization();
    DocumentTypeSetting::query()->whereIn('type', ['invoice', 'cancellation'])->update(['profile' => 'en16931']);

    $offer = app(CreateDocument::class)->handle(systemActor(), [
        'type' => 'offer',
        'customer_id' => Customer::factory()->create()->id,
        'groups' => [
            ['title' => 'Konzept & UX', 'positions' => [itemRow('Discovery-Workshop', '1', '890')]],
            ['title' => 'Betrieb', 'positions' => [itemRow('Wartung & Updates', '12', '149', ['kind' => 'optional'])]],
        ],
    ]);
    $offer = app(SetDocumentStatus::class)->handle(systemActor(), finalized($offer), DocumentStatus::Accepted);

    $invoice = app(ConvertDocument::class)->handle(systemActor(), $offer, DocumentType::Invoice)->document;
    expect(app(DocumentInspector::class)->issues($invoice))->toBe([]);

    $invoice = app(SetDocumentStatus::class)->handle(systemActor(), finalized($invoice), DocumentStatus::Paid);
    $cancellation = finalized(app(CancelInvoice::class)->handle(systemActor(), $invoice)->document);

    $year = now()->format('Y');
    expect($offer->number)->toBe("Q-{$year}-0001")
        ->and($invoice->number)->toBe("INV-{$year}-0001")
        ->and($invoice->groups->pluck('title')->all())->toBe(['Konzept & UX'])
        ->and($cancellation->number)->toBe("CN-{$year}-0001")
        ->and($cancellation->gross_total)->toBe('-1059.10')
        ->and($invoice->fresh()->status)->toBe(DocumentStatus::Cancelled)
        ->and(Document::query()->count())->toBe(3);
});

it('never marks a cancelled invoice as paid, also from a stale model', function () {
    $invoice = finalized(draft());
    $stale = Document::query()->findOrFail($invoice->id);
    finalized(app(CancelInvoice::class)->handle(systemActor(), $invoice)->document);

    expect(fn () => app(SetDocumentStatus::class)->handle(systemActor(), $stale, DocumentStatus::Paid))->toThrow(ActionNotAllowedException::class)
        ->and($invoice->fresh()->status)->toBe(DocumentStatus::Cancelled)
        ->and($invoice->fresh()->paid_at)->toBeNull();
});

it('checks conversions against the current state, not a stale model', function () {
    $invoice = finalized(draft());
    $stale = Document::query()->findOrFail($invoice->id);
    finalized(app(CancelInvoice::class)->handle(systemActor(), $invoice)->document);

    expect(fn () => app(CancelInvoice::class)->handle(systemActor(), $stale))->toThrow(ActionNotAllowedException::class)
        ->and(Document::query()->where('source_id', $invoice->id)->count())->toBe(1);
});

it('keeps a cancellation with the customer of its invoice', function () {
    $invoice = finalized(draft());
    $cancellation = app(CancelInvoice::class)->handle(systemActor(), $invoice)->document;
    $other = Customer::factory()->create();

    try {
        app(UpdateDraft::class)->handle(systemActor(), $cancellation, ['customer_id' => $other->id]);
        $this->fail('no exception');
    } catch (ActionNotAllowedException $e) {
        expect($e->reason)->toBe('cancellation_customer');
    }

    // a write that bypasses UpdateDraft is still caught when finalizing
    Document::query()->whereKey($cancellation->id)->update(['customer_id' => $other->id]);

    expect(fn () => finalized($cancellation->fresh()))->toThrow(ActionNotAllowedException::class)
        ->and($invoice->fresh()->status)->toBe(DocumentStatus::Open)
        ->and(app(UpdateDraft::class)->handle(systemActor(), $cancellation->fresh(), ['customer_id' => $other->id, 'intro' => 'ok'])->intro)->toBe('ok');
});
