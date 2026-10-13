<?php

namespace App\ApiResource;

use ApiPlatform\Metadata\ApiProperty;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\Patch;
use App\Http\Api\ApiMiddleware;
use App\State\Processor\CustomerNumberingProcessor;
use App\State\Provider\CustomerNumberingProvider;

/** Number range of new customers that are created without a number. */
#[ApiResource(
    shortName: 'CustomerNumbering',
    normalizationContext: Normalization::CONTEXT,
    operations: [
        new Get(uriTemplate: '/customer-numbering', uriVariables: [], middleware: ApiMiddleware::READ, provider: CustomerNumberingProvider::class),
        new Patch(
            uriTemplate: '/customer-numbering',
            uriVariables: [],
            middleware: ApiMiddleware::WRITE,
            read: false,
            deserialize: false,
            processor: CustomerNumberingProcessor::class,
            description: 'pattern (placeholders {YYYY}, {YY}, {MM}, {0000}), reset_yearly, next_value.',
        ),
    ],
)]
final class CustomerNumberingResource
{
    public function __construct(
        public string $pattern,
        public bool $reset_yearly,
        public int $next_value,
        #[ApiProperty(writable: false)]
        public string $next_number,
    ) {}

    /**
     * @param  array{pattern: string, reset_yearly: bool, next_value: int, next_number: string}  $range
     */
    public static function fromArray(array $range): self
    {
        return new self($range['pattern'], $range['reset_yearly'], $range['next_value'], $range['next_number']);
    }
}
