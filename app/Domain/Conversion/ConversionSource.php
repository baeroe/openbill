<?php

namespace App\Domain\Conversion;

use App\Domain\Totals\GroupInput;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;

final readonly class ConversionSource
{
    /**
     * @param  array<string, mixed>  $custom
     * @param  list<GroupInput>  $groups
     */
    public function __construct(
        public DocumentType $type,
        public DocumentStatus $status,
        public bool $alreadyCancelled,
        public ?string $serviceDate,
        public ?string $serviceDateEnd,
        public array $custom,
        public array $groups,
    ) {}
}
