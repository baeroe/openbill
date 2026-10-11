<?php

namespace App\Support;

use App\Domain\Tax\LegalNotes;

final class LegalNoteTexts
{
    public static function for(string $locale): LegalNotes
    {
        return new LegalNotes(
            Text::t('legal.small_business', [], $locale),
            Text::t('legal.reverse_charge', [], $locale),
            Text::t('legal.third_country', [], $locale),
        );
    }
}
