<?php

namespace App\Support;

use App\Models\Document;

/** A file an action hands out (PDF, XML, template package); controllers turn it into a download response. */
final readonly class DownloadFile
{
    public function __construct(
        public string $filename,
        public string $mimeType,
        public string $contents,
    ) {}

    /** "INV-2026-0001.pdf", drafts "draft-<id>.pdf". */
    public static function nameFor(Document $document, string $extension): string
    {
        $base = $document->number ?? 'draft-'.$document->id;

        return preg_replace('/[^A-Za-z0-9._-]+/', '-', $base).'.'.$extension;
    }
}
