<?php

namespace App\Domain\Totals;

use App\Domain\Money\Decimal;
use App\Enums\DiscountType;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;

/**
 * Discount of one position: a percentage of the line amount or a fixed amount. The value is never negative; the
 * discount takes the sign of the line amount, so it always moves the line towards zero (a cancellation, which negates
 * the quantity, mirrors its invoice line exactly).
 */
final readonly class LineDiscount
{
    public function __construct(
        public DiscountType $type,
        public BigDecimal $value,
    ) {}

    /** What the line amount (quantity × price, rounded to cents) is reduced by, rounded to cents like the line. */
    public function amountOn(BigDecimal $base): BigDecimal
    {
        $amount = match ($this->type) {
            DiscountType::Percent => $base->abs()->multipliedBy($this->value)->dividedBy(100, 2, RoundingMode::HalfUp),
            DiscountType::Amount => Decimal::round2($this->value),
        };

        return $base->isNegative() ? $amount->negated() : $amount;
    }

    /** More than the whole line: above 100 % or a fixed amount larger than the line amount. */
    public function exceeds(BigDecimal $base): bool
    {
        return match ($this->type) {
            DiscountType::Percent => $this->value->isGreaterThan(100),
            DiscountType::Amount => $this->value->isGreaterThan($base->abs()),
        };
    }
}
