<?php

namespace App\Support;

use App\Enums\DocumentFileKind;
use App\Models\Document;
use Illuminate\Support\Facades\URL;

/**
 * Time-limited download links for PDF/XML that work without a token (MCP tool get-document-pdf-url
 * in phase 8). Signed relative to the host, so they survive a reverse proxy.
 *
 * Finalized documents hand out the archived file. Drafts are rendered live (watermark, one Gotenberg
 * render per call, throttled): their link carries the draft's state ("version" = updated_at) and stops
 * working (403) once the draft changes, so a link never shows content that was not there when it was made.
 */
final class SignedDownloads
{
    public const MINUTES = 15;

    /**
     * @return array{url: string, expires_at: string}
     */
    public function link(Document $document, DocumentFileKind $kind, int $minutes = self::MINUTES): array
    {
        $expires = now()->addMinutes($minutes);
        $parameters = ['id' => $document->id, 'kind' => $kind->value];
        if (! $document->isFinalized()) {
            $parameters['version'] = self::version($document);
        }
        $path = URL::temporarySignedRoute('api.downloads', $expires, $parameters, absolute: false);

        return ['url' => url($path), 'expires_at' => $expires->toAtomString()];
    }

    /** A draft link is valid only for the state it was made for; finalized documents never change. */
    public static function isCurrent(Document $document, ?string $version): bool
    {
        return $document->isFinalized() || $version === self::version($document);
    }

    private static function version(Document $document): string
    {
        return (string) $document->updated_at?->getTimestamp();
    }
}
