<?php

namespace App\State\Provider;

use ApiPlatform\Metadata\CollectionOperationInterface;
use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\ApiResource\FieldDefinitionResource;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Models\FieldDefinition;
use App\State\ApiContext;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** @implements ProviderInterface<FieldDefinitionResource> */
final class FieldDefinitionProvider implements ProviderInterface
{
    /**
     * @return FieldDefinitionResource|list<FieldDefinitionResource>
     */
    public function provide(Operation $operation, array $uriVariables = [], array $context = []): object|array
    {
        if (! $operation instanceof CollectionOperationInterface) {
            return FieldDefinitionResource::fromModel(FieldDefinition::query()->findOrFail((string) $uriVariables['id']));
        }

        return self::list(ApiContext::request($context)->query());
    }

    /**
     * Custom fields of one scope and/or valid for one document type (REST list and MCP list-field-definitions).
     *
     * @param  array<string, mixed>  $query  scope?, doc_type?
     * @return list<FieldDefinitionResource>
     *
     * @throws ValidationException
     */
    public static function list(array $query): array
    {
        $filters = Validator::make($query, [
            'scope' => ['sometimes', Rule::enum(FieldScope::class)],
            'doc_type' => ['sometimes', Rule::enum(DocumentType::class)],
        ])->validate();

        return FieldDefinition::query()
            ->when($filters['scope'] ?? null, fn ($query, string $scope) => $query->where('scope', $scope))
            // org, customer and contact fields apply to every document type
            ->when($filters['doc_type'] ?? null, fn ($query, string $type) => $query->where(
                fn ($where) => $where->whereIn('scope', ['org', 'customer', 'contact'])->orWhereJsonContains('doc_types', $type),
            ))
            ->orderBy('scope')->orderBy('sort')->orderBy('key')
            ->get()
            ->map(fn (FieldDefinition $field): FieldDefinitionResource => FieldDefinitionResource::fromModel($field))
            ->values()
            ->all();
    }
}
