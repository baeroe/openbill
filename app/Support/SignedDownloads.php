<?php

namespace App\Support;

use App\Enums\DocumentFileKind;
use App\Models\Document;
use Illuminate\Support\Facades\URL;

/**
 * Time-limited download links for PDF/XML that work without a token (MCP tool get-document-pdf-url
 * in phase 8). Signed relative to the host, so they survive a reverse proxy.
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
        $path = URL::temporarySignedRoute('api.downloads', $expires, ['id' => $document->id, 'kind' => $kind->value], absolute: false);

        return ['url' => url($path), 'expires_at' => $expires->toAtomString()];
    }
}
