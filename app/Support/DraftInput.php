<?php

namespace App\Support;

use App\Domain\Fields\CustomValueValidator;
use App\Domain\Fields\FieldRegistry;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\PositionKind;
use App\Models\Contact;
use App\Models\Document;
use App\Rules\DecimalString;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Validation of draft input (UpdateDraft, and the unsaved draft of RenderPreview): Laravel rules plus
 * custom values, optional positions and contact ↔ customer. Returns the input with normalized custom values.
 */
final class DraftInput
{
    public const FIELDS = ['date', 'customer_id', 'contact_id', 'service_date', 'service_date_end', 'due_date', 'valid_until', 'intro', 'closing', 'template_id', 'locale', 'custom'];

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public static function validate(Document $document, array $input): array
    {
        return self::checkDomain($document, Validator::make($input, self::rules())->validate());
    }

    /**
     * @return array<string, mixed>
     */
    public static function rules(): array
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
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    private static function checkDomain(Document $document, array $data): array
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
