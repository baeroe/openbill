<?php

namespace App\Domain\Numbering;

use DateTimeInterface;

/** Placeholders: {YYYY}, {YY}, {MM}, {0000} (running number, padded to the count of zeros). */
final class NumberFormatter
{
    public static function format(string $pattern, DateTimeInterface $date, int $sequence): string
    {
        $year = $date->format('Y');
        $result = str_replace(['{YYYY}', '{YY}', '{MM}'], [$year, substr($year, -2), $date->format('m')], $pattern);

        return (string) preg_replace_callback(
            '/\{(0+)\}/',
            fn (array $m): string => str_pad((string) $sequence, strlen($m[1]), '0', STR_PAD_LEFT),
            $result,
        );
    }

    public static function isValidPattern(string $pattern): bool
    {
        return preg_match('/\{0+\}/', $pattern) === 1;
    }

    public static function hasYear(string $pattern): bool
    {
        return str_contains($pattern, '{YYYY}') || str_contains($pattern, '{YY}');
    }
}
