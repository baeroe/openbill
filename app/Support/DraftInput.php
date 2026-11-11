<?php

namespace App\Support;

use App\Domain\Fields\CustomValueValidator;
use App\Domain\Fields\FieldRegistry;
use App\Domain\Money\Decimal;
use App\Enums\DiscountType;
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
            'groups.*.positions.*.discount_type' => ['sometimes', 'nullable', Rule::enum(DiscountType::class)],
            // percent or amount, both with at most two decimals (the e-invoice prints percentages with two)
            'groups.*.positions.*.discount_value' => ['sometimes', 'nullable', new DecimalString(2)],
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

                [$discount, $message] = self::discount($position);
                $data['groups'][$g]['positions'][$p] = [...$data['groups'][$g]['positions'][$p], ...$discount];
                if ($message !== null) {
                    $messages[$path.'discount_value'][] = $message;
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

    /**
     * The discount of a position as it is stored: none for text lines or without a type (a lone value is dropped),
     * otherwise type and value, a percentage 0–100 or an amount ≥ 0. Whether an amount fits the line is a compliance
     * issue (discount_exceeds_line): quantity and price may still change while the draft is edited.
     *
     * @param  array<string, mixed>  $position  validated by rules()
     * @return array{0: array{discount_type: string|null, discount_value: string|null}, 1: string|null}
     */
    private static function discount(array $position): array
    {
        $type = $position['discount_type'] ?? null;
        if ($position['kind'] === PositionKind::Text->value || $type === null) {
            return [['discount_type' => null, 'discount_value' => null], null];
        }
        $value = $position['discount_value'] ?? null;
        $stored = ['discount_type' => $type, 'discount_value' => $value === null ? null : (string) $value];
        if ($value === null) {
            return [$stored, Text::t('errors.discount_value_missing')];
        }
        $decimal = Decimal::of($value);
        if ($decimal->isNegative()) {
            return [$stored, Text::t('errors.discount_negative')];
        }
        if ($type === DiscountType::Percent->value && $decimal->isGreaterThan(100)) {
            return [$stored, Text::t('errors.discount_percent_range')];
        }

        return [$stored, null];
    }
}
