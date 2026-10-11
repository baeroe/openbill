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
        if (! $document->isFinalized() || ! StatusMachine::canSetManually($document->type, $document->status, $status)) {
            throw ActionNotAllowedException::statusTransition($document->status, $status);
        }

        return DB::transaction(function () use ($actor, $document, $status): Document {
            $from = $document->status;
            $document->forceFill([
                'status' => $status,
                'paid_at' => $status === DocumentStatus::Paid ? now() : $document->paid_at,
            ])->save();
            EventLog::record($document, $actor, EventAction::StatusChanged, ['from' => $from->value, 'to' => $status->value]);

            return $document;
        });
    }
}
