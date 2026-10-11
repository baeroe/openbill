<?php

namespace App\Actions;

use App\Domain\Fields\FieldRegistry;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Enums\FieldScope;
use App\Exceptions\ActionNotAllowedException;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Models\Organization;
use App\Support\Actor;
use App\Support\DomainMapper;
use App\Support\EventLog;
use App\Support\GroupWriter;
use Carbon\CarbonImmutable;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * New draft with the defaults of its document type. Any further draft field in $input goes through
 * UpdateDraft in the same transaction, so invalid input leaves nothing behind.
 * Cancellations only come from an invoice (CancelInvoice).
 */
final class CreateDocument
{
    public function __construct(private readonly UpdateDraft $updateDraft) {}

    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ActionNotAllowedException|ValidationException
     */
    public function handle(Actor $actor, array $input): Document
    {
        $data = Validator::make($input, [
            'type' => ['required', Rule::enum(DocumentType::class)],
            'customer_id' => ['sometimes', 'nullable', 'string', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'date' => ['sometimes', 'required', 'date_format:Y-m-d'],
        ])->validate();

        $type = DocumentType::from($data['type']);
        if ($type === DocumentType::Cancellation) {
            throw ActionNotAllowedException::cancellationNeedsInvoice();
        }

        return DB::transaction(function () use ($actor, $input, $data, $type): Document {
            $setting = DocumentTypeSetting::query()->with(['introBlock', 'closingBlock'])->findOrFail($type->value);
            $customer = isset($data['customer_id']) ? Customer::query()->findOrFail($data['customer_id']) : null;
            $date = CarbonImmutable::parse($data['date'] ?? now()->toDateString());
            $fields = FieldRegistry::forScope(DomainMapper::currentFieldDefinitions(), FieldScope::Document, $type);

            $document = new Document;
            $document->forceFill([
                'type' => $type,
                'status' => DocumentStatus::Draft,
                'date' => $date->toDateString(),
                'customer_id' => $customer?->id,
                'contact_id' => $customer?->contacts()->where('is_default', true)->value('id'),
                'service_date' => $type === DocumentType::Invoice ? $date->toDateString() : null,
                'due_date' => $type === DocumentType::Invoice && $setting->payment_term_days !== null
                    ? $date->addDays($setting->payment_term_days)->toDateString() : null,
                'valid_until' => $type === DocumentType::Offer && $setting->validity_days !== null
                    ? $date->addDays($setting->validity_days)->toDateString() : null,
                'intro' => $setting->introBlock->body ?? '',
                'closing' => $setting->closingBlock->body ?? '',
                'template_id' => $setting->template_id,
                'locale' => $customer->locale ?? Organization::current()->locale,
                'custom' => FieldRegistry::defaults($fields),
                'net_total' => '0.00',
                'tax_total' => '0.00',
                'gross_total' => '0.00',
                'created_by' => $actor->userId,
            ])->save();

            GroupWriter::replace($document, [['title' => null, 'positions' => []]]);
            EventLog::record($document, $actor, EventAction::Created, ['type' => $type->value]);

            $rest = Arr::except($input, ['type', 'customer_id', 'date']);

            return $rest === [] ? $document->load('groups.positions') : $this->updateDraft->handle($actor, $document, $rest);
        });
    }
}
