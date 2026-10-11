<?php

namespace App\Domain\Tax;

use App\Enums\TaxCategory;
use Brick\Math\BigDecimal;

final readonly class TaxRateData
{
    public function __construct(
        public string $id,
        public BigDecimal $percent,
        public TaxCategory $category,
        public ?string $exemptionNote = null,
    ) {}
}
