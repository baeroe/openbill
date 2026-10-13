<?php

namespace App\Domain\Numbering;

/**
 * The customer number range that continues what openbill handed out before customer numbering became a setting:
 * the highest number of the form "<no digits><digits>" from 1000 on gives prefix, width and the next value
 * ("K-1004" → "K-{0000}", 1005); without one "C-{0000}" from 1001.
 */
final class RangeFromNumbers
{
    public const DEFAULT_PATTERN = 'C-{0000}';

    public const DEFAULT_NEXT = 1001;

    /**
     * @param  iterable<mixed>  $numbers
     * @return array{pattern: string, next_value: int}
     */
    public static function guess(iterable $numbers): array
    {
        $max = self::DEFAULT_NEXT - 1;
        $range = ['pattern' => self::DEFAULT_PATTERN, 'next_value' => self::DEFAULT_NEXT];
        foreach ($numbers as $number) {
            // braces would turn into placeholders; the counter ends at 99999999
            if (preg_match('/^([^\d{}]*)(\d{1,8})$/', (string) $number, $m) === 1 && (int) $m[2] >= $max && (int) $m[2] < 99999999) {
                $max = (int) $m[2];
                $range = ['pattern' => $m[1].'{'.str_repeat('0', strlen($m[2])).'}', 'next_value' => $max + 1];
            }
        }

        return $range;
    }
}
