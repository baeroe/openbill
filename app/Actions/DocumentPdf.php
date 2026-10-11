<?php

namespace App\Actions;

use App\Enums\DocumentFileKind;
use App\Exceptions\ArchiveCorruptedException;
use App\Exceptions\PdfRenderFailedException;
use App\Exceptions\TemplateRenderFailedException;
use App\Models\Document;
use App\Rendering\DocumentRenderer;
use App\Rendering\PdfArchive;
use App\Support\Actor;
use App\Support\DownloadFile;
use App\Support\SnapshotBuilder;

/**
 * PDF download. Finalized: always the archived file (checked against its SHA-256), never rendered again –
 * later changes to customers, tax rates, templates or fields can't touch it. Draft: rendered live from the
 * current master data with a watermark, not archived.
 */
final class DocumentPdf
{
    public function __construct(
        private readonly PdfArchive $archive,
        private readonly DocumentRenderer $renderer,
        private readonly SnapshotBuilder $snapshots,
    ) {}

    /**
     * @throws ArchiveCorruptedException|TemplateRenderFailedException|PdfRenderFailedException
     */
    public function handle(Actor $actor, Document $document): DownloadFile
    {
        $name = DownloadFile::nameFor($document, 'pdf');
        if ($document->isFinalized()) {
            $file = $document->files()->where('kind', DocumentFileKind::Pdf)->first()
                ?? throw ArchiveCorruptedException::noFile($document, DocumentFileKind::Pdf);

            return new DownloadFile($name, 'application/pdf', $this->archive->read($file));
        }

        $document->loadMissing('groups.positions');

        return new DownloadFile($name, 'application/pdf', $this->renderer->render($document, $this->snapshots->build($document), draft: true)->pdf);
    }
}
