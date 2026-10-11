<?php

namespace App\Domain\Totals;

use Brick\Math\BigDecimal;

final readonly class GroupTotal
{
    public function __construct(
        public string $groupId,
        public ?string $title,
        public BigDecimal $net,
        public BigDecimal $optionalNet,
    ) {}
}
