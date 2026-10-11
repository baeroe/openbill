<?php

namespace App\Rendering\Liquid;

use App\Rendering\NumberText;
use App\Support\Text;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Carbon\CarbonImmutable;
use Closure;
use Keepsuit\Liquid\Exceptions\StandardException;
use Keepsuit\Liquid\Filters\FiltersProvider;
use Keepsuit\Liquid\Filters\StandardFilters;
use Throwable;

/**
 * openbill's Liquid filters. Every public method is a filter (keepsuit registers them by name).
 * Values in the context are HTML-escaped strings already (LiquidRenderer), so nothing here escapes.
 */
final class OpenbillFilters extends FiltersProvider
{
    /** Euro amount in the document language: "1.234,50 €" (de), "€1,234.50" (en); '' for non-numbers. */
    public function money(mixed $value, mixed $decimals = 2): string
    {
        $amount = self::decimal($value);
        if ($amount === null) {
            return '';
        }
        $text = NumberText::format($amount, self::digits($decimals), $this->env()->locale);
        $sign = str_starts_with($text, '-') ? '-' : '';
        $text = ltrim($text, '-');

        return $this->env()->locale === 'de' ? "{$sign}{$text} €" : "{$sign}€{$text}";
    }

    /** Number in the document language with $decimals decimals (default 2); '' for non-numbers. */
    public function number(mixed $value, mixed $decimals = 2): string
    {
        $amount = self::decimal($value);

        return $amount === null ? '' : NumberText::format($amount, self::digits($decimals), $this->env()->locale);
    }

    /**
     * "04.10.2026" (de) / "Oct 4, 2026" (en). With a format argument it behaves like Liquid's standard
     * date filter (strftime: "%d.%m.%Y"). Empty for empty values, the value itself when it is no date.
     */
    public function date(mixed $value, mixed $format = null): string
    {
        if (! is_string($value) || trim($value) === '') {
            return '';
        }
        try {
            $date = CarbonImmutable::parse($value);
        } catch (Throwable) {
            return $value;
        }
        if (is_string($format) && $format !== '') {
            return (string) (new StandardFilters)->date($value, $format);
        }

        return $this->env()->locale === 'de' ? $date->format('d.m.Y') : $date->format('M j, Y');
    }

    /** Line breaks → <br>. */
    public function nl2br(mixed $value): string
    {
        return is_scalar($value) ? str_replace(["\r\n", "\r", "\n"], '<br>', (string) $value) : '';
    }

    /** Template word: manifest "translations" of the document language, then lang template.<key>, else the key. */
    public function t(mixed $key): string
    {
        if (! is_string($key) || $key === '') {
            return '';
        }
        $env = $this->env();
        $own = $env->translations[$env->locale][$key] ?? null;
        if (is_string($own)) {
            return $own;
        }
        $text = Text::t("template.{$key}", [], $env->locale);

        return $text === "template.{$key}" ? $key : $text;
    }

    /**
     * Liquid math without floats: amounts are decimal strings, so plus/minus/times/divided_by/round compute
     * with BigDecimal and return a decimal string. Two integers keep Liquid's integer semantics.
     */
    public function plus(mixed $input, mixed $operand): int|string
    {
        return self::math($input, $operand, fn (BigDecimal $a, BigDecimal $b): BigDecimal => $a->plus($b), fn (int $a, int $b): int => $a + $b);
    }

    public function minus(mixed $input, mixed $operand): int|string
    {
        return self::math($input, $operand, fn (BigDecimal $a, BigDecimal $b): BigDecimal => $a->minus($b), fn (int $a, int $b): int => $a - $b);
    }

    public function times(mixed $input, mixed $operand): int|string
    {
        return self::math($input, $operand, fn (BigDecimal $a, BigDecimal $b): BigDecimal => $a->multipliedBy($b), fn (int $a, int $b): int => $a * $b);
    }

    /**
     * @throws StandardException on division by zero
     */
    public function dividedBy(mixed $input, mixed $operand): int|string
    {
        if ((self::decimal($operand) ?? BigDecimal::zero())->isZero()) {
            throw new StandardException('divided by 0');
        }

        return self::math(
            $input,
            $operand,
            fn (BigDecimal $a, BigDecimal $b): BigDecimal => $a->dividedBy($b, 10, RoundingMode::HalfUp)->strippedOfTrailingZeros(),
            fn (int $a, int $b): int => intdiv($a, $b) - (($a % $b !== 0 && ($a < 0) !== ($b < 0)) ? 1 : 0),
        );
    }

    /** Commercial rounding (half up) to $decimals decimals. */
    public function round(mixed $input, mixed $decimals = 0): int|string
    {
        if (is_int($input)) {
            return $input;
        }
        $value = self::decimal($input) ?? BigDecimal::zero();

        return (string) $value->toScale(max(0, min(10, is_numeric($decimals) ? (int) $decimals : 0)), RoundingMode::HalfUp);
    }

    /** Context values are escaped already: escape works like escape_once and never escapes twice. */
    public function escape(mixed $input): string
    {
        return is_scalar($input) ? htmlspecialchars((string) $input, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8', false) : '';
    }

    /**
     * @param  Closure(BigDecimal, BigDecimal): BigDecimal  $decimal
     * @param  Closure(int, int): int  $integer
     */
    private static function math(mixed $input, mixed $operand, Closure $decimal, Closure $integer): int|string
    {
        if (is_int($input) && is_int($operand)) {
            return $integer($input, $operand);
        }

        return (string) $decimal(self::decimal($input) ?? BigDecimal::zero(), self::decimal($operand) ?? BigDecimal::zero());
    }

    private function env(): RenderEnv
    {
        $env = $this->context->getRegister(RenderEnv::REGISTER);

        return $env instanceof RenderEnv ? $env : new RenderEnv('en');
    }

    private static function decimal(mixed $value): ?BigDecimal
    {
        if (is_int($value)) {
            return BigDecimal::of($value);
        }
        // float literals in a template ("times: 1.19"): their shortest decimal text is what the author wrote
        if (is_float($value) && is_finite($value)) {
            return BigDecimal::of((string) $value);
        }
        if (is_string($value) && preg_match('/^-?\d+(\.\d+)?$/', trim($value)) === 1) {
            return BigDecimal::of(trim($value));
        }

        return null;
    }

    private static function digits(mixed $decimals): int
    {
        $digits = is_int($decimals) || (is_string($decimals) && ctype_digit($decimals)) ? (int) $decimals : 2;

        return max(0, min(6, $digits));
    }
}
