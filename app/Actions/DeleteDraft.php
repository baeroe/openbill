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
        if ($document->isFinalized()) {
            throw DocumentLockedException::for($document);
        }

        DB::transaction(function () use ($actor, $document): void {
            EventLog::record($document, $actor, EventAction::Deleted, ['type' => $document->type->value, 'customer_id' => $document->customer_id]);
            $document->delete();
        });
    }
}
