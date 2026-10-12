<?php

namespace App\Rendering;

/**
 * Pages of a PDF from the /Count of its page tree (the largest one is the root). Chromium writes the page
 * tree as plain objects; for compressed object streams or anything that is no PDF the answer is null.
 */
final class PdfPageCount
{
    public static function of(string $pdf): ?int
    {
        if (! str_starts_with($pdf, '%PDF-') || preg_match_all('#<<((?:(?!<<|>>).)*)>>#s', $pdf, $dictionaries) === false) {
            return null;
        }

        $counts = [];
        foreach ($dictionaries[1] as $dictionary) {
            if (preg_match('#/Type\s*/Pages\b#', $dictionary) === 1 && preg_match('#/Count\s+(\d+)#', $dictionary, $match) === 1) {
                $counts[] = (int) $match[1];
            }
        }

        return $counts === [] ? null : max($counts);
    }
}
