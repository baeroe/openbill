<?php

namespace App\Rendering;

use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Support\Text;

/** manifest.json of a template package. Paths without the "manifest." prefix (the import adds it). */
final class ManifestValidator
{
    /**
     * @return array<string, string> path => message
     */
    public static function validate(mixed $manifest): array
    {
        if (! is_array($manifest) || array_is_list($manifest)) {
            return ['manifest' => Text::t('template_package.manifest_object')];
        }

        $errors = [];
        foreach (['name' => 100, 'version' => 32, 'author' => 255, 'license' => 64, 'description' => 1000] as $field => $max) {
            $value = $manifest[$field] ?? null;
            $required = $field === 'name' || $field === 'version';
            if ($value === null && ! $required) {
                continue;
            }
            if (! is_string($value) || ($required && trim($value) === '') || mb_strlen($value) > $max) {
                $errors[$field] = $required && ! (is_string($value) && trim($value) !== '')
                    ? Text::t('template_package.required', ['field' => $field])
                    : Text::t('template_package.string', ['field' => $field, 'max' => $max]);
            }
        }
        if (! isset($errors['version']) && preg_match('/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/', (string) $manifest['version']) !== 1) {
            $errors['version'] = Text::t('template_package.version');
        }

        if (array_key_exists('documentTypes', $manifest)) {
            $types = $manifest['documentTypes'];
            if (! is_array($types) || ! array_is_list($types) || $types === []
                || array_filter($types, fn (mixed $t): bool => ! is_string($t) || DocumentType::tryFrom($t) === null) !== []) {
                $errors['documentTypes'] = Text::t('template_package.document_types');
            }
        }

        $fields = $manifest['expectedFields'] ?? [];
        if (! is_array($fields) || ! array_is_list($fields)) {
            $errors['expectedFields'] = Text::t('template_package.expected_fields', ['index' => 0]);
        } else {
            foreach ($fields as $i => $field) {
                if (! is_array($field) || ! is_string($field['key'] ?? null)
                    || FieldScope::tryFrom((string) ($field['scope'] ?? '')) === null
                    || FieldType::tryFrom((string) ($field['type'] ?? '')) === null) {
                    $errors["expectedFields.{$i}"] = Text::t('template_package.expected_fields', ['index' => $i]);
                }
            }
        }

        $errors = [...$errors, ...Paper::errors($manifest['paper'] ?? null)];

        if (array_key_exists('translations', $manifest)) {
            $translations = $manifest['translations'];
            $valid = is_array($translations) && ! array_is_list($translations);
            foreach ($valid ? $translations : [] as $locale => $words) {
                $valid = $valid && in_array($locale, ['en', 'de'], true) && is_array($words)
                    && array_filter($words, fn (mixed $w, mixed $k): bool => ! is_string($k) || ! is_string($w), ARRAY_FILTER_USE_BOTH) === [];
            }
            if (! $valid) {
                $errors['translations'] = Text::t('template_package.translations');
            }
        }

        return $errors;
    }
}
