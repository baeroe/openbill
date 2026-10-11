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

        $filters = Validator::make(ApiContext::request($context)->query(), [
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
            ->all();
    }
}
