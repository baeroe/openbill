<?php

namespace App\Rendering\Liquid;

use App\Rendering\NumberText;
use App\Support\Text;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Support\Str;
use Keepsuit\Liquid\Exceptions\ResourceLimitException;
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
        $this->guardDigits($value);
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
        $this->guardDigits($value);
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
            // every strftime directive expands to at most ~30 bytes
            $this->guardLength(strlen($format) * 16);

            return (string) (new StandardFilters)->date($value, $format);
        }

        return $this->env()->locale === 'de' ? $date->format('d.m.Y') : $date->format('M j, Y');
    }

    /** Line breaks → <br>. */
    public function nl2br(mixed $value): string
    {
        $this->guardLength(is_scalar($value) ? strlen((string) $value) * 4 : 0);

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
        return $this->math($input, $operand, fn (BigDecimal $a, BigDecimal $b): BigDecimal => $a->plus($b), fn (int $a, int $b): int => $a + $b);
    }

    public function minus(mixed $input, mixed $operand): int|string
    {
        return $this->math($input, $operand, fn (BigDecimal $a, BigDecimal $b): BigDecimal => $a->minus($b), fn (int $a, int $b): int => $a - $b);
    }

    public function times(mixed $input, mixed $operand): int|string
    {
        return $this->math($input, $operand, fn (BigDecimal $a, BigDecimal $b): BigDecimal => $a->multipliedBy($b), fn (int $a, int $b): int => $a * $b);
    }

    /**
     * @throws StandardException on division by zero
     */
    public function dividedBy(mixed $input, mixed $operand): int|string
    {
        if ((self::decimal($operand) ?? BigDecimal::zero())->isZero()) {
            throw new StandardException('divided by 0');
        }

        return $this->math(
            $input,
            $operand,
            fn (BigDecimal $a, BigDecimal $b): BigDecimal => $a->dividedBy($b, 10, RoundingMode::HalfUp)->strippedOfTrailingZeros(),
            fn (int $a, int $b): int => intdiv($a, $b) - (($a % $b !== 0 && ($a < 0) !== ($b < 0)) ? 1 : 0),
        );
    }

    /** Commercial rounding (half up) to $decimals decimals. */
    public function round(mixed $input, mixed $decimals = 0): int|string
    {
        $this->guardDigits($input);
        if (is_int($input)) {
            return $input;
        }
        $value = self::decimal($input) ?? BigDecimal::zero();

        return (string) $value->toScale(max(0, min(10, is_numeric($decimals) ? (int) $decimals : 0)), RoundingMode::HalfUp);
    }

    /*
     * String filters that can multiply their input check the size of their result before building it: a single
     * call ("30 000 × x" replaced by 30 000 characters) would otherwise allocate gigabytes at once.
     */

    public function replace(mixed $input, mixed $search, mixed $replace = ''): string
    {
        [$input, $search, $replace] = [self::str($input), self::str($search), self::str($replace)];
        $grow = $search === '' ? 0 : substr_count($input, $search) * (strlen($replace) - strlen($search));
        $this->guardLength(strlen($input) + max(0, $grow));

        return str_replace($search, $replace, $input);
    }

    public function replaceFirst(mixed $input, mixed $search, mixed $replace = ''): string
    {
        [$input, $search, $replace] = [self::str($input), self::str($search), self::str($replace)];
        $this->guardLength(strlen($input) + strlen($replace));

        return Str::replaceFirst($search, $replace, $input);
    }

    public function replaceLast(mixed $input, mixed $search, mixed $replace = ''): string
    {
        [$input, $search, $replace] = [self::str($input), self::str($search), self::str($replace)];
        $this->guardLength(strlen($input) + strlen($replace));

        return Str::replaceLast($search, $replace, $input);
    }

    public function append(mixed $input, mixed $string): string
    {
        [$input, $string] = [self::str($input), self::str($string)];
        $this->guardLength(strlen($input) + strlen($string));

        return $input.$string;
    }

    public function prepend(mixed $input, mixed $string): string
    {
        [$input, $string] = [self::str($input), self::str($string)];
        $this->guardLength(strlen($input) + strlen($string));

        return $string.$input;
    }

    /**
     * @return list<string>
     */
    public function split(mixed $input, mixed $separator = ' '): array
    {
        [$input, $separator] = [self::str($input), self::str($separator)];
        // every item of an array costs far more than its bytes: cap the count like a range
        $this->guardCount($separator === '' ? strlen($input) : substr_count($input, $separator) + 1);
        if ($input === '') {
            return [];
        }

        return $separator === '' ? str_split($input) : explode($separator, $input);
    }

    public function modulo(mixed $input, mixed $operand): int|string
    {
        if ((self::decimal($operand) ?? BigDecimal::zero())->isZero()) {
            throw new StandardException('divided by 0');
        }

        return $this->math($input, $operand, fn (BigDecimal $a, BigDecimal $b): BigDecimal => $a->remainder($b), fn (int $a, int $b): int => $a % $b);
    }

    public function join(mixed $input, mixed $glue = ' '): string
    {
        $items = is_iterable($input) ? array_map(self::str(...), [...$input]) : [self::str($input)];
        $glue = self::str($glue);
        $this->guardCount(count($items));
        $this->guardLength(array_sum(array_map(strlen(...), $items)) + max(0, count($items) - 1) * strlen($glue));

        return implode($glue, $items);
    }

    /**
     * @return list<mixed>
     */
    public function concat(mixed $input, mixed $join): array
    {
        $input = is_iterable($input) ? [...$input] : [];
        $join = is_iterable($join) ? [...$join] : [];
        $this->guardCount(count($input) + count($join));

        return [...array_values($input), ...array_values($join)];
    }

    public function base64Encode(mixed $input): string
    {
        $input = self::str($input);
        $this->guardLength(4 * intdiv(strlen($input) + 2, 3));

        return base64_encode($input);
    }

    public function urlEncode(mixed $input): string
    {
        $input = self::str($input);
        $this->guardLength(3 * strlen($input));

        return urlencode($input);
    }

    public function newlineToBr(mixed $input): string
    {
        $input = self::str($input);
        $this->guardLength(strlen($input) + 6 * substr_count($input, "\n"));

        return preg_replace('/\r?\n/', "<br />\n", $input) ?? $input;
    }

    /** Multibyte case mapping can make a character up to three times longer ("ß" → "SS", "ŉ" → "ʼN"). */
    public function upcase(mixed $input): string
    {
        $input = self::str($input);
        $this->guardLength(3 * strlen($input));

        return Str::upper($input);
    }

    public function downcase(mixed $input): string
    {
        $input = self::str($input);
        $this->guardLength(3 * strlen($input));

        return Str::lower($input);
    }

    public function capitalize(mixed $input): string
    {
        $input = self::str($input);
        $this->guardLength(3 * strlen($input));

        return Str::upper(Str::substr($input, 0, 1)).Str::lower(Str::substr($input, 1));
    }

    /** htmlentities: one byte becomes at most an 8-byte entity. Never escapes twice. */
    public function escapeOnce(mixed $input): string
    {
        $input = self::str($input);
        $this->guardLength(8 * strlen($input));

        return htmlentities($input, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8', false);
    }

    /** Context values are escaped already: escape works like escape_once and never escapes twice. */
    public function escape(mixed $input): string
    {
        $this->guardLength(is_scalar($input) ? 6 * strlen((string) $input) : 0);

        return is_scalar($input) ? htmlspecialchars((string) $input, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8', false) : '';
    }

    /**
     * @param  Closure(BigDecimal, BigDecimal): BigDecimal  $decimal
     * @param  Closure(int, int): int  $integer
     */
    private function math(mixed $input, mixed $operand, Closure $decimal, Closure $integer): int|string
    {
        $this->guardDigits($input);
        $this->guardDigits($operand);
        if (is_int($input) && is_int($operand)) {
            return $integer($input, $operand);
        }

        return (string) $decimal(self::decimal($input) ?? BigDecimal::zero(), self::decimal($operand) ?? BigDecimal::zero());
    }

    /**
     * @throws ResourceLimitException
     */
    private function guardLength(int $bytes): void
    {
        $this->env()->checkBudget();
        if ($bytes > (int) config('openbill.rendering.max_output_bytes')) {
            throw new ResourceLimitException;
        }
    }

    /**
     * @throws ResourceLimitException
     */
    private function guardCount(int $items): void
    {
        $this->env()->checkBudget();
        if ($items > 10 * (int) config('openbill.rendering.max_range')) {
            throw new ResourceLimitException;
        }
    }

    /**
     * @throws ResourceLimitException
     */
    private function guardDigits(mixed $value): void
    {
        $this->env()->checkBudget();
        if ((is_string($value) && strlen($value) > FilterPolicy::MAX_DIGITS)) {
            throw new ResourceLimitException;
        }
    }

    private static function str(mixed $value): string
    {
        return is_scalar($value) ? (string) $value : '';
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
