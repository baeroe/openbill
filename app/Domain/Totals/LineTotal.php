<?php

namespace App\Domain\Totals;

use App\Domain\Tax\EffectiveTax;
use Brick\Math\BigDecimal;

/** $net = $beforeDiscount - $discount (all rounded to cents; the discount has the sign of the line). */
final readonly class LineTotal
{
    public function __construct(
        public string $positionId,
        public BigDecimal $net,
        public ?EffectiveTax $tax,
        public BigDecimal $beforeDiscount,
        public BigDecimal $discount,
    ) {}
}
