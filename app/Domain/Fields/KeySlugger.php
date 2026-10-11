<?php

namespace App\Domain\Fields;

use Normalizer;

final class KeySlugger
{
    private const TRANSLIT = ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss'];

    /** snake_case key from a label, e.g. "Größe der Fläche" → "groesse_der_flaeche". */
    public static function slug(string $label): string
    {
        $base = strtr(mb_strtolower($label), self::TRANSLIT);
        $base = (string) preg_replace('/\p{Mn}/u', '', (string) Normalizer::normalize($base, Normalizer::FORM_KD));
        $base = trim((string) preg_replace('/[^a-z0-9]+/', '_', $base), '_');

        if ($base === '') {
            return '';
        }

        return preg_match('/^[a-z]/', $base) === 1 ? $base : 'f_'.$base;
    }

    public static function isValid(string $key): bool
    {
        return strlen($key) <= 64 && preg_match('/^[a-z][a-z0-9_]*$/', $key) === 1;
    }
}
