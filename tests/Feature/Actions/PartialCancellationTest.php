<?php

use App\Actions\CancelInvoice;
use App\Actions\FinalizeDocument;
use App\Actions\SetDocumentStatus;
use App\Actions\UpdateDraft;
use App\Contracts\DocumentArchiver;
use App\Domain\Compliance\ComplianceRule;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Exceptions\ComplianceFailedException;
use App\Mcp\Tools\GetOverviewTool;
use App\Models\Document;
use App\Support\DocumentInspector;
use App\Support\DocumentQuery;
use App\Support\InvoiceBalance;
use App\Support\NullDocumentArchiver;
use App\Support\Overview;
use Carbon\CarbonImmutable;

/*
 * Review M1: a cancellation credits more than 0 and at most what is left of its invoice. Only one that covers the rest
 * cancels the invoice; a partial one leaves it open with a smaller balance everywhere.
 */
beforeEach(function () {
    app()->bind(DocumentArchiver::class, NullDocumentArchiver::class);
    $this->travelTo('2026-10-11 10:00:00');
});

/** Invoice of 10 × 95.00 + 19 % = 1130.50, due 2026-10-01 (overdue on 2026-10-11). */
function partialInvoice(): Document
{
    return app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')], ['due_date' => '2026-10-01']));
}

/** The cancellation draft of $invoice with $quantity hours (negative = credit). */
function cancellationDraft(Document $invoice, string $quantity): Document
{
    $draft = app(CancelInvoice::class)->handle(systemActor(), $invoice->fresh())->document;

    return app(UpdateDraft::class)->handle(systemActor(), $draft, ['groups' => [['title' => null, 'positions' => [itemRow('Workshop', $quantity, '95')]]]]);
}

/** @return list<string> */
function finalizeCodes(Document $document): array
{
    try {
        app(FinalizeDocument::class)->handle(systemActor(), $document);
    } catch (ComplianceFailedException $e) {
        return array_column($e->toArray(), 'code');
    }
    throw new RuntimeException('Expected a ComplianceFailedException.');
}

it('leaves the invoice open with the rest after a partial cancellation and cancels it with the last one', function () {
    $invoice = partialInvoice();

    $first = app(FinalizeDocument::class)->handle(systemActor(), cancellationDraft($invoice, '-4'));
    $invoice->refresh();

    expect($first->gross_total)->toBe('-452.20')
        ->and($invoice->status)->toBe(DocumentStatus::Open)
        ->and($invoice->cancelled_by_id)->toBeNull()
        ->and(InvoiceBalance::of($invoice))->toBe('678.30')
        ->and($invoice->events()->where('action', EventAction::Cancelled)->sole()->payload)
        ->toBe(['cancellation_id' => $first->id, 'number' => $first->number, 'partial' => true, 'remaining' => '678.30']);

    // the next draft starts from all positions again: too much for what is left
    $second = app(CancelInvoice::class)->handle(systemActor(), $invoice)->document;
    expect($second->id)->not->toBe($first->id)
        ->and(collect(app(DocumentInspector::class)->issues($second))->pluck('rule')->all())->toContain(ComplianceRule::CancellationExceedsInvoice)
        ->and(finalizeCodes($second))->toBe(['cancellation_exceeds_invoice']);

    $last = app(FinalizeDocument::class)->handle(systemActor(), cancellationDraft($invoice, '-6'));
    $invoice->refresh();

    expect($invoice->status)->toBe(DocumentStatus::Cancelled)
        ->and($invoice->cancelled_by_id)->toBe($last->id)
        ->and(InvoiceBalance::of($invoice))->toBe('0.00');
});

it('refuses a cancellation that credits nothing or more than the invoice', function (string $quantity, string $code) {
    $invoice = partialInvoice();

    expect(finalizeCodes(cancellationDraft($invoice, $quantity)))->toBe([$code])
        ->and($invoice->fresh()->status)->toBe(DocumentStatus::Open);
})->with([
    'positive total' => ['4', 'cancellation_not_credit'],
    'more than the invoice' => ['-11', 'cancellation_exceeds_invoice'],
]);

it('answers 422 with the code at POST /api/documents/{id}/finalize', function () {
    $draft = cancellationDraft(partialInvoice(), '-11');

    $this->withToken(apiToken())->postJson("/api/documents/{$draft->id}/finalize")
        ->assertUnprocessable()
        ->assertJsonPath('reason', 'compliance_failed')
        ->assertJsonPath('violations.0.code', 'cancellation_exceeds_invoice')
        ->assertJsonPath('violations.0.path', 'positions');
});

it('counts only the rest of a partially cancelled invoice as open and overdue everywhere', function () {
    $invoice = partialInvoice();
    app(FinalizeDocument::class)->handle(systemActor(), cancellationDraft($invoice, '-4'));
    $today = CarbonImmutable::parse('2026-10-11');

    $overview = Overview::build($today);
    expect($overview['figures']['open'])->toBe(['gross' => '678.30', 'count' => 1])
        ->and($overview['figures']['overdue'])->toBe(['gross' => '678.30', 'count' => 1])
        ->and(collect($overview['attention'])->firstWhere('id', $invoice->id))->toMatchArray(['gross_total' => '1130.50', 'open_amount' => '678.30'])
        ->and(Overview::openByCustomer($today)[$invoice->customer_id])->toBe(['gross' => '678.30', 'count' => 1, 'overdue' => 1])
        ->and(DocumentQuery::summary(['status' => 'open'], '2026-10-11'))->toBe(['count' => 1, 'gross_total' => '678.30'])
        ->and(DocumentQuery::summary(['status' => 'overdue'], '2026-10-11'))->toBe(['count' => 1, 'gross_total' => '678.30'])
        // all documents: the invoice and its (negative) cancellation
        ->and(DocumentQuery::summary([], '2026-10-11'))->toBe(['count' => 2, 'gross_total' => '678.30'])
        ->and(mcpJson(mcpTool(GetOverviewTool::class))['figures']['open']['gross'])->toBe('678.30');

    $row = collect($this->withToken(apiToken())->getJson('/api/documents?type=invoice', ['Accept' => 'application/json'])->json())->firstWhere('id', $invoice->id);
    expect($row)->toMatchArray(['gross_total' => '1130.50', 'open_amount' => '678.30', 'status' => 'open']);
});

it('can still mark a partially cancelled invoice as paid, with its rest as paid amount', function () {
    $invoice = partialInvoice();
    app(FinalizeDocument::class)->handle(systemActor(), cancellationDraft($invoice, '-4'));

    $paid = app(SetDocumentStatus::class)->handle(systemActor(), $invoice->fresh(), DocumentStatus::Paid);

    expect($paid->status)->toBe(DocumentStatus::Paid)
        ->and(Overview::build(CarbonImmutable::parse('2026-10-11'))['figures']['paid_month'])->toBe(['gross' => '678.30', 'count' => 1])
        ->and(Overview::build(CarbonImmutable::parse('2026-10-11'))['figures']['open'])->toBe(['gross' => '0.00', 'count' => 0]);

    // and the paid rest can be cancelled, which cancels the invoice
    app(FinalizeDocument::class)->handle(systemActor(), cancellationDraft($paid, '-6'));
    expect($paid->fresh()->status)->toBe(DocumentStatus::Cancelled);
});
