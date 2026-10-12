<?php

namespace App\Actions;

use App\Contracts\DocumentArchiver;
use App\Domain\Lifecycle\StatusMachine;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Exceptions\ActionNotAllowedException;
use App\Exceptions\ComplianceFailedException;
use App\Exceptions\DocumentLockedException;
use App\Models\Document;
use App\Support\Actor;
use App\Support\DocumentInspector;
use App\Support\EventLog;
use App\Support\InvoiceBalance;
use App\Support\SnapshotBuilder;
use Illuminate\Support\Facades\DB;

/**
 * Draft → open (cancellation: closed). One transaction: check profile (a cancellation: at most what is left of its
 * invoice), allocate number, freeze master data (snapshot), mark the invoice of a cancellation that covers the rest
 * as cancelled, archive (PDF/XML), log.
 * Any exception rolls everything back; the number stays free.
 */
final class FinalizeDocument
{
    public function __construct(
        private readonly AllocateDocumentNumber $numbers,
        private readonly DocumentInspector $inspector,
        private readonly SnapshotBuilder $snapshots,
        private readonly DocumentArchiver $archiver,
    ) {}

    /**
     * @throws DocumentLockedException|ComplianceFailedException|ActionNotAllowedException
     */
    public function handle(Actor $actor, Document $document): Document
    {
        return DB::transaction(function () use ($actor, $document): Document {
            $draft = Document::query()->lockForUpdate()->findOrFail($document->id);
            if ($draft->isFinalized()) {
                throw DocumentLockedException::for($draft);
            }
            // a cancellation locks its invoice first: two cancellations of one invoice finalize one after the other,
            // and the second one sees what the first one left (InvoiceBalance::locked)
            $invoice = null;
            $cancellable = null;
            if ($draft->type === DocumentType::Cancellation) {
                $invoice = $draft->source_id === null ? null : Document::query()->lockForUpdate()->find($draft->source_id);
                if ($invoice === null
                    || $invoice->type !== DocumentType::Invoice
                    || ! in_array($invoice->status, [DocumentStatus::Open, DocumentStatus::Paid], true)
                    || $invoice->cancelled_by_id !== null) {
                    throw ActionNotAllowedException::cancellationSource();
                }
                if ($draft->customer_id !== $invoice->customer_id) {
                    throw ActionNotAllowedException::cancellationCustomer();
                }
                $cancellable = InvoiceBalance::locked($invoice);
            }
            $draft->load('groups.positions');

            $sources = $this->snapshots->build($draft);
            $issues = $this->inspector->issues($draft, $sources, $cancellable);
            if ($issues !== []) {
                throw new ComplianceFailedException($issues);
            }

            $totals = $this->inspector->totals($draft, $sources);
            $this->inspector->applyTotals($draft, $totals);
            $draft->forceFill([
                'number' => $this->numbers->handle($draft->type, $draft->date->toDateString()),
                'status' => StatusMachine::finalizedStatus($draft->type),
                'finalized_at' => now(),
            ])->save();
            $snapshot = $draft->snapshot()->create(['data' => $sources]);

            if ($invoice !== null) {
                // only a cancellation that covers the rest cancels the invoice; a partial one leaves it open (or paid)
                // with a smaller balance
                $rest = $cancellable->plus($totals->gross);
                if ($rest->isZero()) {
                    $invoice->forceFill(['status' => DocumentStatus::Cancelled, 'cancelled_by_id' => $draft->id])->save();
                }
                EventLog::record($invoice, $actor, EventAction::Cancelled, [
                    'cancellation_id' => $draft->id,
                    'number' => $draft->number,
                    'partial' => ! $rest->isZero(),
                    'remaining' => (string) $rest,
                ]);
            }

            $this->archiver->archive($draft, $snapshot);
            EventLog::record($draft, $actor, EventAction::Finalized, ['number' => $draft->number]);

            return $draft->load(['groups.positions', 'snapshot']);
        });
    }
}
