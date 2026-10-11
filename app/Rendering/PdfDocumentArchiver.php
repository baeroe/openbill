<?php

namespace App\Rendering;

use App\Contracts\DocumentArchiver;
use App\Enums\DocumentFileKind;
use App\Models\Document;
use App\Models\DocumentSnapshot;

/** Phase 3 archiver: renders the finalized document from its snapshot and stores PDF (+ XML). */
final class PdfDocumentArchiver implements DocumentArchiver
{
    public function __construct(
        private readonly DocumentRenderer $renderer,
        private readonly PdfArchive $archive,
    ) {}

    public function archive(Document $document, DocumentSnapshot $snapshot): void
    {
        $rendered = $this->renderer->render($document, $snapshot->data, draft: false);

        $this->archive->store($document, DocumentFileKind::Pdf, $rendered->pdf);
        if ($rendered->xml !== null) {
            $this->archive->store($document, DocumentFileKind::Xml, $rendered->xml);
        }
    }
}
