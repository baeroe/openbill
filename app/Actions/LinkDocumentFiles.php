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
     * @return array{document_id: string, number: string|null, status: string, pdf: array{url: string, expires_at: string}, xml: array{url: string, expires_at: string}|null, attachments?: list<array{title: string, number: string, url: string, expires_at: string}>}
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
            ...($document->isFinalized() ? $this->attachments($document) : []),
        ];
    }

    /**
     * The frozen attachments of a finalized quote or confirmation, each a signed link to the archived PDF of the text
     * document version that was current when it was finalized (not the newest one).
     *
     * @return array{attachments?: list<array{title: string, number: string, url: string, expires_at: string}>}
     */
    private function attachments(Document $document): array
    {
        $rows = $document->snapshot?->data['attachments'] ?? [];
        if ($rows === []) {
            return [];
        }
        $texts = Document::query()->whereIn('id', array_column($rows, 'document_id'))->get()->keyBy('id');

        return ['attachments' => array_values(array_filter(array_map(function (array $row) use ($texts): ?array {
            $text = $texts->get($row['document_id']);

            return $text === null ? null : ['title' => $row['title'], 'number' => $row['number'], ...$this->downloads->link($text, DocumentFileKind::Pdf)];
        }, $rows)))];
    }
}
