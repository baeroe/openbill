<?php

namespace App\Support;

/** __() that always returns a string (Larastan types __() as string|array). */
final class Text
{
    /**
     * @param  array<string, string|int>  $replace
     */
    public static function t(string $key, array $replace = [], ?string $locale = null): string
    {
        $text = __($key, $replace, $locale);

        return is_string($text) ? $text : $key;
    }
}
