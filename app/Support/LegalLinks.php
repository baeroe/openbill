<?php

namespace App\Support;

use App\Models\Document;

/** Addresses of the public texts (routes/legal.php) on the configured instance address, never on the host of a request. */
final class LegalLinks
{
    public static function latest(string $slug): string
    {
        return self::base().'/legal/'.rawurlencode($slug);
    }

    public static function version(string $slug, string $number): string
    {
        return self::latest($slug).'/'.rawurlencode($number);
    }

    /** Link of this version: only a finalized, public text document without customer has one. */
    public static function versionOf(Document $document): ?string
    {
        return self::isPublished($document) ? self::version((string) $document->slug, (string) $document->number) : null;
    }

    public static function latestOf(Document $document): ?string
    {
        return self::isPublished($document) ? self::latest((string) $document->slug) : null;
    }

    private static function isPublished(Document $document): bool
    {
        return $document->isFinalized() && $document->is_public && $document->customer_id === null
            && $document->slug !== null && $document->number !== null;
    }

    private static function base(): string
    {
        return rtrim((string) config('app.url'), '/');
    }
}
