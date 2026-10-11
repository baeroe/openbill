<?php

namespace App\Rendering;

use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;

/** Decimal → "1.234,50" (de) / "1,234.50" (en), commercial rounding, no floats. */
final class NumberText
{
    public static function format(BigDecimal $value, int $decimals, string $locale): string
    {
        $rounded = $value->toScale($decimals, RoundingMode::HalfUp);
        [$integer, $fraction] = array_pad(explode('.', (string) $rounded->abs()), 2, '');
        $grouped = strrev(implode($locale === 'de' ? '.' : ',', str_split(strrev($integer), 3)));
        $text = $fraction === '' ? $grouped : $grouped.($locale === 'de' ? ',' : '.').$fraction;

        return ($rounded->isNegative() ? '-' : '').$text;
    }
}
