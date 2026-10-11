<?php

namespace App\Domain\Totals;

use App\Domain\Tax\EffectiveTax;
use Brick\Math\BigDecimal;

final readonly class LineTotal
{
    public function __construct(
        public string $positionId,
        public BigDecimal $net,
        public ?EffectiveTax $tax,
    ) {}
}
