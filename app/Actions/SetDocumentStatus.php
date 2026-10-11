<?php

namespace App\Actions;

use App\Domain\Lifecycle\StatusMachine;
use App\Enums\DocumentStatus;
use App\Enums\EventAction;
use App\Exceptions\ActionNotAllowedException;
use App\Models\Document;
use App\Support\Actor;
use App\Support\EventLog;
use Illuminate\Support\Facades\DB;

/** Manual status change of a finalized document (accepted, rejected, done, paid). Leaving draft = FinalizeDocument. */
final class SetDocumentStatus
{
    /**
     * @throws ActionNotAllowedException
     */
    public function handle(Actor $actor, Document $document, DocumentStatus $status): Document
    {
        return DB::transaction(function () use ($actor, $document, $status): Document {
            // re-read under lock: $document may be stale (e.g. its cancellation was finalized in between)
            $locked = Document::query()->lockForUpdate()->findOrFail($document->id);
            if (! $locked->isFinalized() || ! StatusMachine::canSetManually($locked->type, $locked->status, $status)) {
                throw ActionNotAllowedException::statusTransition($locked->status, $status);
            }

            $from = $locked->status;
            $locked->forceFill([
                'status' => $status,
                'paid_at' => $status === DocumentStatus::Paid ? now() : $locked->paid_at,
            ])->save();
            EventLog::record($locked, $actor, EventAction::StatusChanged, ['from' => $from->value, 'to' => $status->value]);

            return $locked;
        });
    }
}
