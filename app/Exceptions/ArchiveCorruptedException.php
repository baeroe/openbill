<?php

namespace App\Exceptions;

use App\Enums\DocumentFileKind;
use App\Models\Document;
use App\Models\DocumentFile;
use RuntimeException;

/** An archived file is missing or no longer matches its SHA-256: a server problem, never re-rendered. */
final class ArchiveCorruptedException extends RuntimeException
{
    public static function missing(DocumentFile $file): self
    {
        return new self("Archive file {$file->path} of document {$file->document_id} is missing.");
    }

    public static function checksum(DocumentFile $file): self
    {
        return new self("Archive file {$file->path} of document {$file->document_id} does not match its SHA-256.");
    }

    public static function noFile(Document $document, DocumentFileKind $kind): self
    {
        return new self("Finalized document {$document->id} has no archived {$kind->value} file.");
    }
}
