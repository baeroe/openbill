<?php

namespace App\Actions;

use App\Domain\Fields\CustomValueValidator;
use App\Domain\Fields\FieldDefinitionData;
use App\Domain\Fields\FieldDefinitionValidator;
use App\Domain\Fields\FieldRegistry;
use App\Domain\Fields\KeySlugger;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Models\FieldDefinition;
use App\Support\Actor;
use App\Support\DomainMapper;
use App\Support\FieldErrors;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Creates or updates a custom field. Scope and key are fixed after creation (templates use the key). */
final class SaveFieldDefinition
{
    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, array $input, ?FieldDefinition $definition = null): FieldDefinition
    {
        $data = Validator::make($input, [
            'scope' => [$definition === null ? 'required' : 'sometimes', Rule::enum(FieldScope::class)],
            'key' => ['sometimes', 'nullable', 'string', 'max:64'],
            'label' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::enum(FieldType::class)],
            'required' => ['sometimes', 'boolean'],
            'default_value' => ['sometimes', 'nullable'],
            'help' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'options' => ['sometimes', 'array', 'list', 'max:100'],
            'options.*' => ['string', 'max:255'],
            'doc_types' => ['sometimes', 'array', 'list'],
            'doc_types.*' => [Rule::enum(DocumentType::class)],
            'sort' => ['sometimes', 'integer', 'min:0'],
        ])->validate();

        $scope = $definition === null ? FieldScope::from($data['scope']) : $definition->scope;
        $key = $definition !== null ? $definition->key : (is_string($data['key'] ?? null) && $data['key'] !== '' ? $data['key'] : KeySlugger::slug($data['label']));
        $docTypes = FieldRegistry::hasDocTypes($scope) ? array_values(array_unique($data['doc_types'] ?? [])) : [];
        $options = array_values(array_filter(array_map('trim', $data['options'] ?? []), fn (string $o): bool => $o !== ''));

        $candidate = new FieldDefinitionData(
            scope: $scope,
            key: $key,
            label: trim($data['label']),
            type: FieldType::from($data['type']),
            required: (bool) ($data['required'] ?? false),
            defaultValue: $data['default_value'] ?? null,
            options: $options,
            docTypes: array_map(fn (string $t): DocumentType => DocumentType::from($t), $docTypes),
            id: $definition?->id,
        );
        FieldErrors::throwIfAny(FieldDefinitionValidator::validate($candidate, DomainMapper::currentFieldDefinitions()));

        $definition ??= new FieldDefinition;
        $sort = $data['sort'] ?? ($definition->exists ? $definition->sort : (int) FieldDefinition::query()->where('scope', $scope)->max('sort') + 1);
        $definition->forceFill([
            'scope' => $scope,
            'key' => $key,
            'label' => $candidate->label,
            'type' => $candidate->type,
            'required' => $candidate->required,
            'default_value' => FieldRegistry::isEmpty($candidate->defaultValue) ? null : CustomValueValidator::normalize($candidate, $candidate->defaultValue),
            'help' => (string) ($data['help'] ?? ''),
            'options' => $options,
            'doc_types' => $docTypes,
            'sort' => $sort,
        ])->save();

        return $definition;
    }
}
