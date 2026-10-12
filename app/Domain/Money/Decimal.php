<?php

namespace App\Domain\Money;

use Brick\Math\BigDecimal;
use Brick\Math\BigNumber;
use Brick\Math\RoundingMode;

/** Amounts are never floats: strings or ints in, BigDecimal inside, strings out. */
final class Decimal
{
    public static function of(BigNumber|int|string $value): BigDecimal
    {
        return BigDecimal::of($value);
    }

    public static function zero(): BigDecimal
    {
        return BigDecimal::zero();
    }

    /** Commercial rounding to cents, half away from zero (the prototype's round2). */
    public static function round2(BigDecimal $value): BigDecimal
    {
        return $value->toScale(2, RoundingMode::HalfUp);
    }

    /**
     * True for ints and strings like "12", "-3.5", "0.0001": dot as separator, at most 11 integer digits
     * (DECIMAL(15,4)) and at most $scale decimals. Floats and "12,5" are rejected on purpose.
     */
    public static function isValid(mixed $value, int $scale = 4): bool
    {
        if (is_int($value)) {
            $value = (string) $value;
        }

        return is_string($value) && preg_match('/^-?\d{1,11}(\.\d{1,'.$scale.'})?$/', $value) === 1;
    }
}
