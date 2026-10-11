<?php

namespace App\Actions;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Exceptions\ActionNotAllowedException;
use App\Models\Document;
use App\Support\Actor;
use App\Support\DocumentInspector;
use App\Support\DomainMapper;
use App\Support\EventLog;
use App\Support\GroupWriter;
use Illuminate\Support\Facades\DB;

/** Copy as a new draft dated today, without number, chain or snapshot. Cancellations only come from invoices. */
final class DuplicateDocument
{
    public function __construct(private readonly DocumentInspector $inspector) {}

    /**
     * @throws ActionNotAllowedException
     */
    public function handle(Actor $actor, Document $document): Document
    {
        if ($document->type === DocumentType::Cancellation) {
            throw ActionNotAllowedException::duplicateCancellation();
        }

        return DB::transaction(function () use ($actor, $document): Document {
            $document->loadMissing('groups.positions');
            $copy = $document->replicate(['number', 'status', 'source_id', 'cancelled_by_id', 'finalized_at', 'paid_at', 'created_by']);
            $copy->setRelations([]);
            $copy->forceFill([
                'status' => DocumentStatus::Draft,
                'date' => now()->toDateString(),
                'created_by' => $actor->userId,
            ])->save();

            GroupWriter::replace($copy, DomainMapper::groupRows(DomainMapper::groups($document)));
            $copy->load('groups.positions');
            $this->inspector->applyTotals($copy, $this->inspector->totals($copy));
            $copy->save();

            EventLog::record($copy, $actor, EventAction::Duplicated, ['source_id' => $document->id]);

            return $copy;
        });
    }
}
