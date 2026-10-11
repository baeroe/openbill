<?php

namespace App\Domain\Totals;

use App\Enums\TaxCategory;
use Brick\Math\BigDecimal;

final readonly class TaxBreakdownRow
{
    public function __construct(
        public TaxCategory $category,
        public BigDecimal $percent,
        public BigDecimal $net,
        public BigDecimal $tax,
        public BigDecimal $gross,
    ) {}
}
