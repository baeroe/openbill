<?php

namespace App\Actions;

use App\Enums\DocumentFileKind;
use App\Exceptions\ActionNotAllowedException;
use App\Exceptions\ArchiveCorruptedException;
use App\Models\Document;
use App\Rendering\PdfArchive;
use App\Support\Actor;
use App\Support\DownloadFile;

/** The archived EN 16931 XML of a finalized e-invoice (the same bytes that are embedded in its PDF). */
final class DocumentXml
{
    public function __construct(private readonly PdfArchive $archive) {}

    /**
     * @throws ActionNotAllowedException|ArchiveCorruptedException
     */
    public function handle(Actor $actor, Document $document): DownloadFile
    {
        $file = $document->isFinalized() ? $document->files()->where('kind', DocumentFileKind::Xml)->first() : null;
        if ($file === null) {
            throw ActionNotAllowedException::noEInvoice();
        }

        return new DownloadFile(DownloadFile::nameFor($document, 'xml'), 'application/xml', $this->archive->read($file));
    }
}
