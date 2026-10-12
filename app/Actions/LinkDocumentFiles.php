<?php

namespace App\Actions;

use App\Enums\DocumentFileKind;
use App\Models\Document;
use App\Support\Actor;
use App\Support\SignedDownloads;

/**
 * MCP get-document-pdf-url: signed links (15 minutes, no token needed) instead of file contents. The XML link
 * exists only for a finalized e-invoice; a draft link stops working once the draft changes (SignedDownloads).
 */
final class LinkDocumentFiles
{
    public function __construct(private readonly SignedDownloads $downloads) {}

    /**
     * @return array{document_id: string, number: string|null, status: string, pdf: array{url: string, expires_at: string}, xml: array{url: string, expires_at: string}|null}
     */
    public function handle(Actor $actor, Document $document): array
    {
        $hasXml = $document->isFinalized() && $document->files()->where('kind', DocumentFileKind::Xml)->exists();

        return [
            'document_id' => $document->id,
            'number' => $document->number,
            'status' => $document->status->value,
            'pdf' => $this->downloads->link($document, DocumentFileKind::Pdf),
            'xml' => $hasXml ? $this->downloads->link($document, DocumentFileKind::Xml) : null,
        ];
    }
}
