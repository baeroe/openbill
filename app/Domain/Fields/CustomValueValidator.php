<?php

namespace App\Domain\Fields;

use App\Domain\Money\Decimal;
use App\Enums\FieldType;
use DateTimeImmutable;

final class CustomValueValidator
{
    private const MAX_TEXT = 1000;

    private const MAX_TEXTAREA = 10000;

    private const MAX_IMAGE = 2048;

    /**
     * @param  list<FieldDefinitionData>  $definitions  fields valid for this level (and document type)
     * @param  array<array-key, mixed>  $values
     */
    public static function validate(array $definitions, array $values, string $pathPrefix, bool $enforceRequired): CustomValidationResult
    {
        $byKey = [];
        foreach ($definitions as $definition) {
            $byKey[$definition->key] = $definition;
        }

        $clean = [];
        $errors = [];
        foreach ($values as $key => $value) {
            $key = (string) $key;
            $definition = $byKey[$key] ?? null;

            if ($definition === null) {
                $errors[] = new FieldError($pathPrefix.$key, FieldErrorCode::Unknown, ['key' => $key]);

                continue;
            }
            if (FieldRegistry::isEmpty($value)) {
                $clean[$key] = null;

                continue;
            }

            $normalized = self::normalize($definition, $value);
            if ($normalized instanceof FieldErrorCode) {
                $errors[] = new FieldError($pathPrefix.$key, $normalized, self::params($definition));

                continue;
            }
            $clean[$key] = $normalized;
        }

        if ($enforceRequired) {
            foreach ($definitions as $definition) {
                if ($definition->required && FieldRegistry::isEmpty($clean[$definition->key] ?? null)) {
                    $errors[] = new FieldError($pathPrefix.$definition->key, FieldErrorCode::Required, self::params($definition));
                }
            }
        }

        return new CustomValidationResult($clean, $errors);
    }

    /** Normalized value for a non-empty input, or the reason it is invalid. */
    public static function normalize(FieldDefinitionData $definition, mixed $value): string|bool|FieldErrorCode
    {
        return match ($definition->type) {
            FieldType::Text => self::text($value, self::MAX_TEXT),
            FieldType::Textarea => self::text($value, self::MAX_TEXTAREA),
            FieldType::Number => Decimal::isValid($value, 4) ? (string) Decimal::of($value) : FieldErrorCode::NotNumber,
            FieldType::Money => Decimal::isValid($value, 2) ? (string) Decimal::of($value) : FieldErrorCode::NotMoney,
            FieldType::Date => is_string($value) && self::isDate($value) ? $value : FieldErrorCode::NotDate,
            FieldType::Select => is_string($value) && in_array($value, $definition->options, true) ? $value : FieldErrorCode::NotOption,
            FieldType::Boolean => is_bool($value) ? $value : FieldErrorCode::NotBoolean,
            FieldType::Image => is_string($value) && mb_strlen($value) <= self::MAX_IMAGE ? $value : FieldErrorCode::NotImage,
        };
    }

    private static function text(mixed $value, int $max): string|FieldErrorCode
    {
        if (! is_string($value)) {
            return FieldErrorCode::NotText;
        }

        return mb_strlen($value) <= $max ? $value : FieldErrorCode::TooLong;
    }

    private static function isDate(string $value): bool
    {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);

        return $date !== false && $date->format('Y-m-d') === $value;
    }

    /** @return array<string, string> */
    private static function params(FieldDefinitionData $definition): array
    {
        return ['label' => $definition->label, 'key' => $definition->key, 'options' => implode(', ', $definition->options)];
    }
}
