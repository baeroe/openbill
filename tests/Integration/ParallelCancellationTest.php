<?php

use App\Actions\FinalizeDocument;
use App\Contracts\DocumentArchiver;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Document;
use App\Support\GroupWriter;
use App\Support\InvoiceBalance;
use App\Support\NullDocumentArchiver;
use Illuminate\Support\Facades\Concurrency;
use Tests\Integration\ParallelAllocation;

/*
 * Review M1: two partial cancellations of one invoice finalized at the same time never credit more than the invoice –
 * FinalizeDocument locks the invoice and reads its balance with a locking read.
 */
it('lets only one of two parallel cancellations through when together they exceed the invoice', function () {
    app()->bind(DocumentArchiver::class, NullDocumentArchiver::class);
    $invoice = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')]));
    $drafts = array_map(function () use ($invoice): string {
        $cancellation = Document::factory()->type(DocumentType::Cancellation)->create(['customer_id' => $invoice->customer_id, 'source_id' => $invoice->id]);
        GroupWriter::replace($cancellation, [['title' => null, 'positions' => [itemRow('Workshop', '-6', '95')]]]);

        return $cancellation->id;
    }, range(1, 2));

    $results = Concurrency::driver('process')->run([
        ParallelAllocation::finalizeTask([$drafts[0]]),
        ParallelAllocation::finalizeTask([$drafts[1]]),
    ]);
    $outcomes = array_merge(...array_map('array_values', $results));
    sort($outcomes);

    expect($outcomes[0])->toStartWith('CN-')
        ->and($outcomes[1])->toBe('cancellation_exceeds_invoice')
        ->and($invoice->fresh()->status)->toBe(DocumentStatus::Open)
        ->and(InvoiceBalance::of($invoice->fresh()))->toBe('452.20');
});
