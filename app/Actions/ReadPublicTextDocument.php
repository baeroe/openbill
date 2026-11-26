<?php

namespace App\Actions;

use App\Enums\DocumentFileKind;
use App\Exceptions\ArchiveCorruptedException;
use App\Models\Document;
use App\Rendering\PdfArchive;
use App\Support\Actor;
use App\Support\DownloadFile;
use App\Support\TextDocuments;

/**
 * The PDF of a public text document, for anyone. Without a number: the newest version (TextDocuments::latest), if
 * that one is public – a newer, non-public version withdraws the text, older public versions stay reachable by their
 * number so that old quotes keep working links. With a number: exactly this version, if it is public itself. Anything
 * else is null (one and the same 404: no guessing which short name exists). Customer texts, drafts and other
 * document types never qualify.
 */
final class ReadPublicTextDocument
{
    public function __construct(private readonly PdfArchive $archive) {}

    /**
     * @throws ArchiveCorruptedException
     */
    public function handle(Actor $actor, string $slug, ?string $number = null): ?DownloadFile
    {
        $document = $number === null
            ? TextDocuments::latest($slug)
            : TextDocuments::finalizedWithoutCustomer($slug)->where('number', $number)->first();
        if (! $document instanceof Document || ! $document->is_public) {
            return null;
        }

        $file = $document->files()->where('kind', DocumentFileKind::Pdf)->first()
            ?? throw ArchiveCorruptedException::noFile($document, DocumentFileKind::Pdf);

        return new DownloadFile(preg_replace('/[^A-Za-z0-9._-]+/', '-', "{$slug}-{$document->number}").'.pdf', 'application/pdf', $this->archive->read($file));
    }
}
