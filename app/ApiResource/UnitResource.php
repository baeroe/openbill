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
use App\Models\Unit;
use App\State\Processor\UnitProcessor;
use App\State\Provider\UnitProvider;

/** Unit with UN/ECE Recommendation 20 code (HUR, DAY, H87, …). DELETE archives it. */
#[ApiResource(
    shortName: 'Unit',
    normalizationContext: Normalization::CONTEXT,
    operations: [
        new GetCollection(
            uriTemplate: '/units',
            paginationEnabled: false,
            middleware: ApiMiddleware::READ,
            provider: UnitProvider::class,
            parameters: ['include_archived' => new QueryParameter(description: '1 = also list archived units')],
        ),
        new Get(uriTemplate: '/units/{id}', middleware: ApiMiddleware::READ, provider: UnitProvider::class),
        new Post(uriTemplate: '/units', middleware: ApiMiddleware::WRITE, read: false, deserialize: false, processor: UnitProcessor::class),
        new Patch(uriTemplate: '/units/{id}', middleware: ApiMiddleware::WRITE, read: false, deserialize: false, processor: UnitProcessor::class),
        new Delete(uriTemplate: '/units/{id}', middleware: ApiMiddleware::WRITE, read: false, processor: UnitProcessor::class, description: 'Archives the unit.'),
        new Post(
            uriTemplate: '/units/{id}/restore',
            name: 'unit_restore',
            status: 200,
            input: false,
            middleware: ApiMiddleware::WRITE,
            read: false,
            deserialize: false,
            processor: UnitProcessor::class,
            description: 'Restores an archived unit.',
        ),
    ],
)]
final class UnitResource
{
    public function __construct(
        #[ApiProperty(identifier: true, writable: false)]
        public string $id,
        public string $name,
        public string $symbol,
        public int $decimals,
        public string $code,
        public int $sort,
        #[ApiProperty(writable: false)]
        public ?string $archived_at,
    ) {}

    public static function fromModel(Unit $unit): self
    {
        return new self(
            id: $unit->id,
            name: $unit->name,
            symbol: (string) $unit->symbol,
            decimals: $unit->decimals,
            code: (string) $unit->code,
            sort: $unit->sort,
            archived_at: $unit->archived_at?->toAtomString(),
        );
    }
}
