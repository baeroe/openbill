<?php

namespace App\ApiResource;

use ApiPlatform\Metadata\ApiProperty;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use App\Http\Api\ApiMiddleware;
use App\State\Processor\DocumentTypeProcessor;
use App\State\Provider\DocumentTypeProvider;

/** Settings per document type: compliance profile, template, default texts, terms and number range. */
#[ApiResource(
    shortName: 'DocumentType',
    normalizationContext: Normalization::CONTEXT,
    operations: [
        new GetCollection(uriTemplate: '/document-types', paginationEnabled: false, middleware: ApiMiddleware::READ, provider: DocumentTypeProvider::class),
        new Get(uriTemplate: '/document-types/{type}', middleware: ApiMiddleware::READ, provider: DocumentTypeProvider::class),
        new Patch(
            uriTemplate: '/document-types/{type}',
            middleware: ApiMiddleware::WRITE,
            read: false,
            deserialize: false,
            processor: DocumentTypeProcessor::class,
            description: 'profile (en16931 only for invoice/cancellation), template_id, default_intro_block_id, default_closing_block_id, payment_term_days, validity_days, numbering{pattern, reset_yearly, next_value}.',
        ),
    ],
)]
final class DocumentTypeResource
{
    /**
     * @param  array{pattern: string, reset_yearly: bool, next_value: int, next_number: string}  $numbering
     */
    public function __construct(
        #[ApiProperty(identifier: true, writable: false)]
        public string $type,
        public string $profile,
        public ?string $template_id,
        public ?string $default_intro_block_id,
        public ?string $default_closing_block_id,
        public ?int $payment_term_days,
        public ?int $validity_days,
        public array $numbering,
    ) {}
}
