<?php

namespace App\ApiResource;

use ApiPlatform\Metadata\ApiProperty;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\QueryParameter;
use App\Http\Api\ApiMiddleware;
use App\Models\FieldDefinition;
use App\State\Processor\FieldDefinitionProcessor;
use App\State\Provider\FieldDefinitionProvider;

/** Custom field of one level. scope and key are fixed after creation (templates use the key). */
#[ApiResource(
    shortName: 'FieldDefinition',
    normalizationContext: Normalization::CONTEXT,
    operations: [
        new GetCollection(
            uriTemplate: '/field-definitions',
            paginationEnabled: false,
            middleware: ApiMiddleware::READ,
            provider: FieldDefinitionProvider::class,
            parameters: [
                'scope' => new QueryParameter(description: 'org, customer, contact, document or position'),
                'doc_type' => new QueryParameter(description: 'only fields that apply to this document type (offer, confirmation, invoice, cancellation)'),
            ],
        ),
        new Get(uriTemplate: '/field-definitions/{id}', middleware: ApiMiddleware::READ, provider: FieldDefinitionProvider::class),
        new Post(uriTemplate: '/field-definitions', middleware: ApiMiddleware::WRITE, read: false, deserialize: false, processor: FieldDefinitionProcessor::class),
        new Patch(uriTemplate: '/field-definitions/{id}', middleware: ApiMiddleware::WRITE, read: false, deserialize: false, processor: FieldDefinitionProcessor::class),
        new Delete(uriTemplate: '/field-definitions/{id}', middleware: ApiMiddleware::WRITE, read: false, processor: FieldDefinitionProcessor::class),
    ],
)]
final class FieldDefinitionResource
{
    /**
     * @param  list<string>  $options
     * @param  list<string>  $doc_types
     */
    public function __construct(
        #[ApiProperty(identifier: true, writable: false)]
        public string $id,
        public string $scope,
        public string $key,
        public string $label,
        public string $type,
        public bool $required,
        public string|int|bool|null $default_value,
        public string $help,
        public array $options,
        public array $doc_types,
        public int $sort,
    ) {}

    public static function fromModel(FieldDefinition $field): self
    {
        // json cast: Larastan reads it as array, stored values are scalars
        /** @var mixed $default */
        $default = $field->default_value;

        return new self(
            id: $field->id,
            scope: $field->scope->value,
            key: $field->key,
            label: $field->label,
            type: $field->type->value,
            required: $field->required,
            default_value: is_string($default) || is_int($default) || is_bool($default) ? $default : null,
            help: (string) $field->help,
            options: array_values($field->options ?? []),
            doc_types: array_values($field->doc_types ?? []),
            sort: $field->sort,
        );
    }
}
