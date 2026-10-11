<?php

namespace App\Rules;

use App\Domain\Money\Decimal;
use App\Support\Text;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Translation\PotentiallyTranslatedString;

/** Amounts and quantities: int or dot-decimal string, never a float. */
final class DecimalString implements ValidationRule
{
    public function __construct(private readonly int $scale = 4) {}

    /**
     * @param  Closure(string, ?string=): PotentiallyTranslatedString  $fail
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! Decimal::isValid($value, $this->scale)) {
            $fail(Text::t('errors.decimal', ['scale' => $this->scale]));
        }
    }
}
