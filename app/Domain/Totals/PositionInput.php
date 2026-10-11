<?php

namespace App\Domain\Totals;

use App\Enums\PositionKind;
use Brick\Math\BigDecimal;

/** A position as the domain sees it (totals, compliance, conversion). */
final readonly class PositionInput
{
    /**
     * @param  array<string, mixed>  $custom
     */
    public function __construct(
        public string $id,
        public PositionKind $kind,
        public string $title,
        public BigDecimal $quantity,
        public BigDecimal $unitPrice,
        public ?string $unitId,
        public ?string $taxRateId,
        public array $custom = [],
        public string $description = '',
    ) {}
}
