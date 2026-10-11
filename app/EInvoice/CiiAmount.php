<?php

namespace App\EInvoice;

use Brick\Math\BigDecimal;
use LogicException;

/**
 * The one place where amounts become floats: horstoeko/zugferd takes floats and prints them with fixed
 * decimals (2 for amounts, 4 for unit prices and quantities). DECIMAL(15,4) has at most 15 significant
 * digits, which a double holds exactly enough to print back the same decimal – checked on every call.
 */
final class CiiAmount
{
    public static function of(BigDecimal|string $value): float
    {
        $decimal = BigDecimal::of($value);
        $float = $decimal->toFloat();
        if (! BigDecimal::of(sprintf('%.4F', $float))->isEqualTo($decimal)) {
            throw new LogicException("Amount {$decimal} can't be passed to the e-invoice builder without losing digits.");
        }

        return $float;
    }
}
