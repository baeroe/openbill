<?php

namespace App\Actions;

use App\Domain\Fields\CustomValueValidator;
use App\Domain\Fields\FieldRegistry;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Enums\FieldScope;
use App\Enums\PositionKind;
use App\Exceptions\DocumentLockedException;
use App\Models\Contact;
use App\Models\Document;
use App\Rules\DecimalString;
use App\Support\Actor;
use App\Support\DocumentInspector;
use App\Support\DomainMapper;
use App\Support\EventLog;
use App\Support\FieldErrors;
use App\Support\GroupWriter;
use App\Support\Text;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Saves a draft (autosave target). Missing top-level keys stay as they are; `groups`, when given,
 * replaces all groups and positions (ids of this document's own groups/positions are kept).
 * Required custom fields are checked when finalizing, not here.
 */
final class UpdateDraft
{
    private const FIELDS = ['date', 'customer_id', 'contact_id', 'service_date', 'service_date_end', 'due_date', 'valid_until', 'intro', 'closing', 'template_id', 'locale', 'custom'];

    public function __construct(private readonly DocumentInspector $inspector) {}

    /**
     * @param  array<string, mixed>  $input
     *
     * @throws DocumentLockedException|ValidationException
     */
    public function handle(Actor $actor, Document $document, array $input): Document
    {
        if ($document->isFinalized()) {
            throw DocumentLockedException::for($document);
        }

        $data = Validator::make($input, self::rules())->validate();
        $data = $this->checkDomain($document, $data);

        return DB::transaction(function () use ($actor, $document, $data): Document {
            // re-read with a row lock: a finalize that won the race must not be overwritten
            $draft = Document::query()->lockForUpdate()->findOrFail($document->id);
            if ($draft->isFinalized()) {
                throw DocumentLockedException::for($draft);
            }

            $draft->fill(Arr::only($data, self::FIELDS));
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
        });
    }

    /**
     * @return array<string, mixed>
     */
    private static function rules(): array
    {
        $date = ['sometimes', 'nullable', 'date_format:Y-m-d'];

        return [
            'date' => ['sometimes', 'required', 'date_format:Y-m-d'],
            'customer_id' => ['sometimes', 'nullable', 'string', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'contact_id' => ['sometimes', 'nullable', 'string', Rule::exists('contacts', 'id')->whereNull('deleted_at')],
            'service_date' => $date,
            'service_date_end' => $date,
            'due_date' => $date,
            'valid_until' => $date,
            'intro' => ['sometimes', 'nullable', 'string', 'max:20000'],
            'closing' => ['sometimes', 'nullable', 'string', 'max:20000'],
            'template_id' => ['sometimes', 'nullable', 'string', Rule::exists('templates', 'id')],
            'locale' => ['sometimes', 'required', Rule::in(['en', 'de'])],
            'custom' => ['sometimes', 'array'],
            'groups' => ['sometimes', 'array', 'list', 'max:200'],
            'groups.*' => ['array'],
            'groups.*.id' => ['sometimes', 'nullable', 'string'],
            'groups.*.title' => ['sometimes', 'nullable', 'string', 'max:500'],
            'groups.*.positions' => ['sometimes', 'array', 'list', 'max:1000'],
            'groups.*.positions.*' => ['array'],
            'groups.*.positions.*.id' => ['sometimes', 'nullable', 'string'],
            'groups.*.positions.*.kind' => ['required', Rule::enum(PositionKind::class)],
            'groups.*.positions.*.title' => ['sometimes', 'nullable', 'string', 'max:500'],
            'groups.*.positions.*.description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'groups.*.positions.*.quantity' => ['sometimes', new DecimalString(4)],
            'groups.*.positions.*.unit_price' => ['sometimes', new DecimalString(4)],
            'groups.*.positions.*.unit_id' => ['sometimes', 'nullable', 'string', Rule::exists('units', 'id')],
            'groups.*.positions.*.tax_rate_id' => ['sometimes', 'nullable', 'string', Rule::exists('tax_rates', 'id')],
            'groups.*.positions.*.custom' => ['sometimes', 'array'],
        ];
    }

    /**
     * Custom values (type, option, valid for this document type), optional positions and contact ↔ customer.
     * Returns $data with normalized custom values.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    private function checkDomain(Document $document, array $data): array
    {
        $definitions = DomainMapper::currentFieldDefinitions();
        $errors = [];
        $messages = [];

        if (array_key_exists('custom', $data)) {
            $result = CustomValueValidator::validate(FieldRegistry::forScope($definitions, FieldScope::Document, $document->type), $data['custom'], 'custom.', false);
            $errors = $result->errors;
            $data['custom'] = $result->values;
        }

        $positionFields = FieldRegistry::forScope($definitions, FieldScope::Position, $document->type);
        foreach ($data['groups'] ?? [] as $g => $group) {
            foreach ($group['positions'] ?? [] as $p => $position) {
                $path = "groups.{$g}.positions.{$p}.";
                $result = CustomValueValidator::validate($positionFields, $position['custom'] ?? [], $path.'custom.', false);
                $errors = [...$errors, ...$result->errors];
                $data['groups'][$g]['positions'][$p]['custom'] = $result->values;

                if ($position['kind'] === PositionKind::Optional->value && $document->type !== DocumentType::Offer) {
                    $messages[$path.'kind'][] = Text::t('errors.optional_only_offers');
                }
            }
        }

        $customerId = array_key_exists('customer_id', $data) ? $data['customer_id'] : $document->customer_id;
        if (($data['contact_id'] ?? null) !== null
            && ! Contact::query()->whereKey($data['contact_id'])->where('customer_id', $customerId)->exists()) {
            $messages['contact_id'][] = Text::t('errors.contact_not_of_customer');
        }

        $messages = array_merge_recursive(FieldErrors::messages($errors), $messages);
        if ($messages !== []) {
            throw ValidationException::withMessages($messages);
        }

        return $data;
    }
}
