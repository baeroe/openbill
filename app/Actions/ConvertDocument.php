<?php

namespace App\Actions;

use App\Domain\Conversion\DocumentConverter;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Exceptions\ActionNotAllowedException;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Support\Actor;
use App\Support\ConversionResult;
use App\Support\DocumentInspector;
use App\Support\DomainMapper;
use App\Support\EventLog;
use App\Support\GroupWriter;
use Illuminate\Support\Facades\DB;

/**
 * Offer → confirmation/invoice, confirmation → invoice, invoice → cancellation (rules: DocumentConverter).
 * An existing cancellation draft of the invoice counts: it is returned instead of a second one.
 */
final class ConvertDocument
{
    public function __construct(private readonly DocumentInspector $inspector) {}

    /**
     * @throws ActionNotAllowedException
     */
    public function handle(Actor $actor, Document $source, DocumentType $target): ConversionResult
    {
        return DB::transaction(function () use ($actor, $source, $target): ConversionResult {
            // re-read under lock: serializes parallel conversions of the same source (one cancellation draft)
            // and checks the current status, not the one of a stale model
            $source = Document::query()->lockForUpdate()->findOrFail($source->id);
            if (! DocumentConverter::canConvert($source->type, $source->status, $source->cancelled_by_id !== null, $target)) {
                throw ActionNotAllowedException::conversion($source->type, $target);
            }

            if ($target === DocumentType::Cancellation) {
                // locking read: sees a cancellation draft committed after this (possibly outer) transaction
                // took its read view, so a second draft is never created next to it (M-B)
                $existing = Document::query()->where('source_id', $source->id)->where('type', DocumentType::Cancellation)->lockForUpdate()->first();
                if ($existing !== null) {
                    return new ConversionResult($existing->load('groups.positions'), []);
                }
            }

            $source->loadMissing('groups.positions');
            $setting = DocumentTypeSetting::query()->findOrFail($target->value);
            $today = now()->toDateString();
            $plan = DocumentConverter::convert(
                DomainMapper::conversionSource($source),
                $target,
                $setting->payment_term_days,
                DomainMapper::currentFieldDefinitions(),
                $today,
            );

            $document = new Document;
            $document->forceFill([
                'type' => $target,
                'status' => DocumentStatus::Draft,
                'date' => $today,
                'customer_id' => $source->customer_id,
                'contact_id' => $source->contact_id,
                'service_date' => $plan->serviceDate,
                'service_date_end' => $plan->serviceDateEnd,
                'due_date' => $plan->dueDate,
                'valid_until' => null,
                'intro' => $source->intro,
                'closing' => $source->closing,
                'template_id' => $setting->template_id ?? $source->template_id,
                'locale' => $source->locale,
                'custom' => $plan->custom,
                'source_id' => $source->id,
                'created_by' => $actor->userId,
            ])->save();

            GroupWriter::replace($document, DomainMapper::groupRows($plan->groups));
            $document->load('groups.positions');
            $this->inspector->applyTotals($document, $this->inspector->totals($document));
            $document->save();

            EventLog::record($document, $actor, EventAction::ConvertedFrom, ['source_id' => $source->id, 'source_number' => $source->number]);
            EventLog::record($source, $actor, EventAction::Converted, ['target_id' => $document->id, 'type' => $target->value]);

            return new ConversionResult($document, $plan->droppedFields);
        });
    }
}
