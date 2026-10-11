<?php

namespace App\Support;

use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use LogicException;

/** A DECIMAL column or SQL sum as money string with two decimals ("0.00" for no rows). */
final class Amount
{
    public static function of(mixed $value): string
    {
        if (is_float($value)) {
            // MariaDB returns DECIMAL as string; a float here means the PDO settings changed
            throw new LogicException('An amount came back from the database as float.');
        }
        $text = is_string($value) || is_int($value) ? trim((string) $value) : '';

        return (string) BigDecimal::of($text === '' ? '0' : $text)->toScale(2, RoundingMode::HalfUp);
    }
}
