<?php

namespace App\Actions;

use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Exceptions\ActionNotAllowedException;
use App\Exceptions\DocumentLockedException;
use App\Models\Contact;
use App\Models\Document;
use App\Support\Actor;
use App\Support\DocumentInspector;
use App\Support\DraftInput;
use App\Support\EventLog;
use App\Support\GroupWriter;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Saves a draft (autosave target). Missing top-level keys stay as they are; `groups`, when given,
 * replaces all groups and positions (ids of this document's own groups/positions are kept).
 * Required custom fields are checked when finalizing, not here.
 */
final class UpdateDraft
{
    public function __construct(private readonly DocumentInspector $inspector) {}

    /**
     * @param  array<string, mixed>  $input
     *
     * @throws DocumentLockedException|ValidationException|ActionNotAllowedException
     */
    public function handle(Actor $actor, Document $document, array $input): Document
    {
        if ($document->isFinalized()) {
            throw DocumentLockedException::for($document);
        }

        $data = DraftInput::validate($document, $input);

        // retried on deadlocks: SaveCustomer locks customer → drafts, UpdateDraft draft → customer (FK)
        return DB::transaction(function () use ($actor, $document, $data): Document {
            // re-read with a row lock: a finalize that won the race must not be overwritten
            $draft = Document::query()->lockForUpdate()->findOrFail($document->id);
            if ($draft->isFinalized()) {
                throw DocumentLockedException::for($draft);
            }

            if ($draft->type === DocumentType::Cancellation && array_key_exists('customer_id', $data) && $data['customer_id'] !== $draft->customer_id) {
                throw ActionNotAllowedException::cancellationCustomer();
            }

            $draft->fill(Arr::only($data, DraftInput::FIELDS));
            if (array_key_exists('customer_id', $data) && ! array_key_exists('contact_id', $data) && $draft->isDirty('customer_id')) {
                $draft->contact_id = $data['customer_id'] === null
                    ? null
                    : Contact::query()->where('customer_id', $data['customer_id'])->where('is_default', true)->value('id');
            }
            $draft->save();

            if (array_key_exists('groups', $data)) {
                GroupWriter::replace($draft, $data['groups']);
            }
            $draft->load('groups.positions');
            $this->inspector->applyTotals($draft, $this->inspector->totals($draft));
            $draft->save();

            EventLog::record($draft, $actor, EventAction::Updated, ['fields' => array_keys($data)]);

            return $draft;
        }, 3);
    }
}
