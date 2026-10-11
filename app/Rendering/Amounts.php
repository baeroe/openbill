<?php

namespace App\Rendering;

use Brick\Math\BigDecimal;

/** Display form of stored decimals in the template context. */
final class Amounts
{
    /** Quantities: "10.0000" → "10", "1.2500" → "1.25". */
    public static function plain(string|int|null $value): string
    {
        return (string) BigDecimal::of($value ?? 0)->strippedOfTrailingZeros();
    }

    /** Prices keep at least two decimals: "95.0000" → "95.00", "12.3456" stays. */
    public static function price(string|int|null $value): string
    {
        $price = BigDecimal::of($value ?? 0)->strippedOfTrailingZeros();

        return (string) ($price->getScale() < 2 ? $price->toScale(2) : $price);
    }
}
