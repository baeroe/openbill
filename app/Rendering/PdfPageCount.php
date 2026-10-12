<?php

namespace App\Rendering;

/**
 * Pages of a PDF from the /Count of its page tree (the largest one is the root), read object by object so
 * nested dictionaries (e.g. /Resources << … >>) do not hide it. Without a readable tree the plain page objects
 * (/Type /Page) are counted. Compressed object streams or anything that is no PDF give null.
 */
final class PdfPageCount
{
    public static function of(string $pdf): ?int
    {
        if (! str_starts_with($pdf, '%PDF-') || preg_match_all('#\bobj\b(.*?)\bendobj\b#s', $pdf, $objects) === false) {
            return null;
        }

        $counts = [];
        $leaves = 0;
        foreach ($objects[1] as $object) {
            if (preg_match('#/Type\s*/Pages\b#', $object) === 1 && preg_match('#/Count\s+(\d+)#', $object, $match) === 1) {
                $counts[] = (int) $match[1];
            } elseif (preg_match('#/Type\s*/Page\b(?!s)#', $object) === 1) {
                $leaves++;
            }
        }

        if ($counts !== []) {
            return max($counts);
        }

        return $leaves > 0 ? $leaves : null;
    }
}
