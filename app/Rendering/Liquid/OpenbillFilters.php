<?php

namespace App\Rendering\Liquid;

use App\Rendering\NumberText;
use App\Support\Text;
use Brick\Math\BigDecimal;
use Carbon\CarbonImmutable;
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
        // Liquid math (times, plus, …) yields PHP floats; their decimal text is exact enough for display
        if (is_float($value) && is_finite($value)) {
            return BigDecimal::of(sprintf('%.6F', $value));
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
