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
use App\Models\TextBlock;
use App\State\Processor\TextBlockProcessor;
use App\State\Provider\TextBlockProvider;

/** Reusable intro/closing/payment/note text; may contain Liquid placeholders. */
#[ApiResource(
    shortName: 'TextBlock',
    normalizationContext: Normalization::CONTEXT,
    operations: [
        new GetCollection(
            uriTemplate: '/text-blocks',
            paginationEnabled: false,
            middleware: ApiMiddleware::READ,
            provider: TextBlockProvider::class,
            parameters: ['kind' => new QueryParameter(description: 'intro, closing, payment or note')],
        ),
        new Get(uriTemplate: '/text-blocks/{id}', middleware: ApiMiddleware::READ, provider: TextBlockProvider::class),
        new Post(uriTemplate: '/text-blocks', middleware: ApiMiddleware::WRITE, read: false, deserialize: false, processor: TextBlockProcessor::class),
        new Patch(uriTemplate: '/text-blocks/{id}', middleware: ApiMiddleware::WRITE, read: false, deserialize: false, processor: TextBlockProcessor::class),
        new Delete(uriTemplate: '/text-blocks/{id}', middleware: ApiMiddleware::WRITE, read: false, processor: TextBlockProcessor::class),
    ],
)]
final class TextBlockResource
{
    public function __construct(
        #[ApiProperty(identifier: true, writable: false)]
        public string $id,
        public string $name,
        public string $kind,
        public string $body,
        #[ApiProperty(writable: false)]
        public ?string $updated_at,
    ) {}

    public static function fromModel(TextBlock $block): self
    {
        return new self(
            id: $block->id,
            name: $block->name,
            kind: $block->kind->value,
            body: (string) $block->body,
            updated_at: $block->updated_at?->toAtomString(),
        );
    }
}
