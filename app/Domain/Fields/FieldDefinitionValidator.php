<?php

namespace App\Domain\Fields;

use App\Enums\FieldType;

/** Port of validateFieldDef() from prototypes/clickdummy-v2/src/domain/fields.ts. */
final class FieldDefinitionValidator
{
    /**
     * @param  list<FieldDefinitionData>  $existing  all saved definitions (the one being edited included)
     * @return list<FieldError>
     */
    public static function validate(FieldDefinitionData $definition, array $existing): array
    {
        $errors = [];

        if (trim($definition->label) === '') {
            $errors[] = new FieldError('label', FieldErrorCode::LabelMissing);
        }
        if (! KeySlugger::isValid($definition->key)) {
            $errors[] = new FieldError('key', FieldErrorCode::KeyInvalid);
        } elseif (FieldRegistry::isReserved($definition->scope, $definition->key)) {
            $errors[] = new FieldError('key', FieldErrorCode::KeyReserved, ['key' => $definition->key]);
        }
        foreach ($existing as $other) {
            if ($other->scope === $definition->scope && $other->key === $definition->key && $other->id !== $definition->id) {
                $errors[] = new FieldError('key', FieldErrorCode::KeyTaken, ['key' => $definition->key]);
                break;
            }
        }
        if ($definition->type === FieldType::Select && array_filter($definition->options, fn (string $o): bool => trim($o) !== '') === []) {
            $errors[] = new FieldError('options', FieldErrorCode::OptionsMissing);
        }
        if (FieldRegistry::hasDocTypes($definition->scope) && $definition->docTypes === []) {
            $errors[] = new FieldError('doc_types', FieldErrorCode::DocTypesMissing);
        }
        if (! FieldRegistry::isEmpty($definition->defaultValue)) {
            $normalized = CustomValueValidator::normalize($definition, $definition->defaultValue);
            if ($normalized instanceof FieldErrorCode) {
                $errors[] = new FieldError('default_value', $normalized, ['label' => $definition->label, 'options' => implode(', ', $definition->options)]);
            }
        }

        return $errors;
    }
}
