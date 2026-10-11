<?php

namespace App\Actions;

use App\Enums\EventAction;
use App\Exceptions\DocumentLockedException;
use App\Models\Document;
use App\Support\Actor;
use App\Support\EventLog;
use Illuminate\Support\Facades\DB;

/** Deletes a draft with its groups and positions. The "deleted" event stays (document_id becomes NULL). */
final class DeleteDraft
{
    /**
     * @throws DocumentLockedException
     */
    public function handle(Actor $actor, Document $document): void
    {
        DB::transaction(function () use ($actor, $document): void {
            // re-read under lock: $document may be stale (a finalize can commit in between)
            $draft = Document::query()->lockForUpdate()->findOrFail($document->id);
            if ($draft->isFinalized()) {
                throw DocumentLockedException::for($draft);
            }

            EventLog::record($draft, $actor, EventAction::Deleted, ['type' => $draft->type->value, 'customer_id' => $draft->customer_id]);
            $draft->delete();
        });
    }
}
