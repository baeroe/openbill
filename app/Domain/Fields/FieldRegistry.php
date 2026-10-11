<?php

namespace App\Domain\Fields;

use App\Enums\DocumentType;
use App\Enums\FieldScope;

/** Core fields per level (fixed, used by totals and e-invoices) and reserved keys. */
final class FieldRegistry
{
    /** @var array<string, list<string>> */
    public const CORE = [
        'org' => ['name', 'street', 'zip', 'city', 'country', 'logo', 'vat_id', 'tax_number', 'registration_id', 'iban', 'bic', 'bank_name', 'email', 'phone', 'website', 'taxation_mode', 'small_business', 'locale'],
        'customer' => ['number', 'name', 'street', 'zip', 'city', 'country', 'email', 'vat_id', 'tax_treatment', 'locale'],
        'contact' => ['salutation', 'first_name', 'last_name', 'full_name', 'position', 'email', 'phone'],
        'document' => ['number', 'date', 'type_label', 'status', 'due_date', 'valid_until', 'service_date', 'service_date_end', 'intro', 'closing', 'net_total', 'tax_total', 'gross_total', 'optional_total', 'tax_breakdown', 'legal_notes', 'source_number', 'locale'],
        'position' => ['index', 'title', 'description', 'quantity', 'unit', 'unit_code', 'unit_price', 'tax_percent', 'total', 'is_optional', 'is_text', 'group'],
    ];

    /** @var array<string, list<string>> */
    private const EXTRA_RESERVED = [
        'org' => ['id', 'custom'],
        'customer' => ['id', 'custom', 'contacts'],
        'contact' => ['id', 'custom'],
        'document' => ['id', 'custom', 'type', 'customer', 'contact', 'positions', 'groups'],
        'position' => ['id', 'custom', 'kind', 'is_item', 'unit_name'],
    ];

    /** @return list<string> */
    public static function coreKeys(FieldScope $scope): array
    {
        return self::CORE[$scope->value];
    }

    public static function isReserved(FieldScope $scope, string $key): bool
    {
        return in_array($key, self::CORE[$scope->value], true) || in_array($key, self::EXTRA_RESERVED[$scope->value], true);
    }

    public static function hasDocTypes(FieldScope $scope): bool
    {
        return $scope === FieldScope::Document || $scope === FieldScope::Position;
    }

    /**
     * Custom fields of one level; document and position fields filtered by document type.
     *
     * @param  list<FieldDefinitionData>  $definitions
     * @return list<FieldDefinitionData>
     */
    public static function forScope(array $definitions, FieldScope $scope, ?DocumentType $docType = null): array
    {
        return array_values(array_filter(
            $definitions,
            fn (FieldDefinitionData $d): bool => $d->scope === $scope
                && (! self::hasDocTypes($scope) || $docType === null || in_array($docType, $d->docTypes, true)),
        ));
    }

    /**
     * @param  list<FieldDefinitionData>  $definitions
     * @return array<string, mixed>
     */
    public static function defaults(array $definitions): array
    {
        $values = [];
        foreach ($definitions as $definition) {
            if ($definition->defaultValue !== null) {
                $values[$definition->key] = $definition->defaultValue;
            }
        }

        return $values;
    }

    public static function isEmpty(mixed $value): bool
    {
        return $value === null || (is_string($value) && trim($value) === '');
    }
}
