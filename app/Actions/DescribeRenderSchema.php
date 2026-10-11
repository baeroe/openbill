<?php

namespace App\Actions;

use App\Domain\Fields\FieldDefinitionData;
use App\Domain\Fields\FieldRegistry;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Support\Actor;
use App\Support\DomainMapper;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * GET /api/render/schema: core and custom fields per level as templates see them (field bar in phase 7,
 * toolkit field list in phase 9, MCP resource "field schema" in phase 8). document_type filters
 * document and position fields.
 */
final class DescribeRenderSchema
{
    /** Where a level lives in the Liquid context. */
    private const CONTEXT = ['org' => 'org', 'customer' => 'customer', 'contact' => 'contact', 'document' => 'document', 'position' => 'positions[]'];

    /**
     * @param  array<string, mixed>  $input  document_type?
     * @return array{levels: array<string, array{context: string, core: list<string>, custom: list<array{key: string, label: string, type: string, required: bool, options: list<string>, doc_types: list<string>}>}>}
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, array $input): array
    {
        $data = Validator::make($input, ['document_type' => ['sometimes', Rule::enum(DocumentType::class)]])->validate();
        $docType = isset($data['document_type']) ? DocumentType::from($data['document_type']) : null;
        $definitions = DomainMapper::currentFieldDefinitions();

        $levels = [];
        foreach (FieldScope::cases() as $scope) {
            $levels[$scope->value] = [
                'context' => self::CONTEXT[$scope->value],
                'core' => FieldRegistry::coreKeys($scope),
                'custom' => array_map(fn (FieldDefinitionData $field): array => [
                    'key' => $field->key,
                    'label' => $field->label,
                    'type' => $field->type->value,
                    'required' => $field->required,
                    'options' => $field->options,
                    'doc_types' => array_map(fn (DocumentType $type): string => $type->value, $field->docTypes),
                ], FieldRegistry::forScope($definitions, $scope, $docType)),
            ];
        }

        return ['levels' => $levels];
    }
}
