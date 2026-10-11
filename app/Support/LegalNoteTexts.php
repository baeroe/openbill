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

    /**
     * Snapshot form ("legal_notes" in document_snapshots.data).
     *
     * @return array{small_business: string, reverse_charge: string, third_country: string}
     */
    public static function toArray(LegalNotes $notes): array
    {
        return [
            'small_business' => $notes->smallBusiness,
            'reverse_charge' => $notes->reverseCharge,
            'third_country' => $notes->thirdCountry,
        ];
    }

    /**
     * The texts frozen in $sources (snapshot form); translated live only when they are missing.
     *
     * @param  array<string, mixed>  $sources
     */
    public static function fromSources(array $sources, string $locale): LegalNotes
    {
        $notes = $sources['legal_notes'] ?? null;
        if (! is_array($notes)) {
            return self::for($locale);
        }

        return new LegalNotes(
            (string) $notes['small_business'],
            (string) $notes['reverse_charge'],
            (string) $notes['third_country'],
        );
    }
}
