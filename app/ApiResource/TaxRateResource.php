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
use App\Models\TaxRate;
use App\State\Processor\TaxRateProcessor;
use App\State\Provider\TaxRateProvider;

/** Tax rate. DELETE archives it (positions and snapshots keep pointing at it). */
#[ApiResource(
    shortName: 'TaxRate',
    normalizationContext: Normalization::CONTEXT,
    operations: [
        new GetCollection(
            uriTemplate: '/tax-rates',
            paginationEnabled: false,
            middleware: ApiMiddleware::READ,
            provider: TaxRateProvider::class,
            parameters: ['include_archived' => new QueryParameter(description: '1 = also list archived rates')],
        ),
        new Get(uriTemplate: '/tax-rates/{id}', middleware: ApiMiddleware::READ, provider: TaxRateProvider::class),
        new Post(uriTemplate: '/tax-rates', middleware: ApiMiddleware::WRITE, read: false, deserialize: false, processor: TaxRateProcessor::class),
        new Patch(uriTemplate: '/tax-rates/{id}', middleware: ApiMiddleware::WRITE, read: false, deserialize: false, processor: TaxRateProcessor::class),
        new Delete(uriTemplate: '/tax-rates/{id}', middleware: ApiMiddleware::WRITE, read: false, processor: TaxRateProcessor::class, description: 'Archives the rate.'),
    ],
)]
final class TaxRateResource
{
    public function __construct(
        #[ApiProperty(identifier: true, writable: false)]
        public string $id,
        public string $label,
        public string $percent,
        public string $category,
        public ?string $exemption_note,
        public int $sort,
        #[ApiProperty(writable: false)]
        public ?string $archived_at,
    ) {}

    public static function fromModel(TaxRate $rate): self
    {
        return new self(
            id: $rate->id,
            label: $rate->label,
            percent: (string) $rate->percent,
            category: $rate->category->value,
            exemption_note: $rate->exemption_note,
            sort: $rate->sort,
            archived_at: $rate->archived_at?->toAtomString(),
        );
    }
}
