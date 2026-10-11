<?php

namespace App\Rendering;

use App\Enums\DocumentFileKind;
use App\Exceptions\ArchiveCorruptedException;
use App\Models\Document;
use App\Models\DocumentFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Archive of finalized documents on the disk "archive": {yyyy}/{document_id}.pdf|xml plus a
 * document_files row with SHA-256 and size. Files are written while FinalizeDocument's transaction is open.
 */
final class PdfArchive
{
    private const DISK = 'archive';

    /**
     * Writes to .tmp/ first and renames into place (atomic: never a half-written archive file). If the
     * transaction rolls back, the file is deleted again. A file left behind by a crash at the same path
     * belongs to no finalized document (the document is still a draft) and is overwritten.
     */
    public function store(Document $document, DocumentFileKind $kind, string $contents): DocumentFile
    {
        $disk = Storage::disk(self::DISK);
        $path = $document->date->format('Y')."/{$document->id}.{$kind->value}";
        $temporary = '.tmp/'.Str::ulid().'.'.$kind->value;

        $disk->put($temporary, $contents);
        DB::afterRollBack(function () use ($disk, $temporary, $path): void {
            $disk->delete([$temporary, $path]);
        });
        $disk->delete($path);
        $disk->move($temporary, $path);

        return $document->files()->create([
            'kind' => $kind,
            'path' => $path,
            'sha256' => hash('sha256', $contents),
            'size' => strlen($contents),
        ]);
    }

    /**
     * @throws ArchiveCorruptedException
     */
    public function read(DocumentFile $file): string
    {
        $disk = Storage::disk(self::DISK);
        if (! $disk->exists($file->path)) {
            throw ArchiveCorruptedException::missing($file);
        }
        $contents = (string) $disk->get($file->path);
        if (! hash_equals($file->sha256, hash('sha256', $contents))) {
            throw ArchiveCorruptedException::checksum($file);
        }

        return $contents;
    }
}
