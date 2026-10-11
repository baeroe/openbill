<?php

use App\Actions\CancelInvoice;
use App\Actions\FinalizeDocument;
use App\Contracts\DocumentArchiver;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Document;
use App\Support\NullDocumentArchiver;
use Illuminate\Support\Facades\DB;

/*
 * M-B (phase 2 re-review): the lookup of an existing cancellation draft must see rows another
 * request committed after the surrounding transaction took its read view (REPEATABLE READ).
 */
it('finds a cancellation draft committed by another connection after the outer transaction started reading', function () {
    app()->bind(DocumentArchiver::class, NullDocumentArchiver::class);
    $invoice = app(FinalizeDocument::class)->handle(systemActor(), draft());
    config(['database.connections.second' => config('database.connections.'.config('database.default'))]);

    DB::beginTransaction();
    try {
        Document::query()->count(); // the outer transaction's read view starts here

        $other = (new Document)->setConnection('second');
        $other->forceFill([
            'type' => DocumentType::Cancellation,
            'status' => DocumentStatus::Draft,
            'date' => now()->toDateString(),
            'customer_id' => $invoice->customer_id,
            'locale' => $invoice->locale,
            'source_id' => $invoice->id,
            'net_total' => '0.00',
            'tax_total' => '0.00',
            'gross_total' => '0.00',
        ])->save();

        $found = app(CancelInvoice::class)->handle(systemActor(), $invoice)->document;

        expect($found->id)->toBe($other->id);
    } finally {
        DB::rollBack();
        DB::purge('second');
    }
});
