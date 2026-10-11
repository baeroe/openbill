<?php

namespace App\Http\Api;

use App\Support\DownloadFile;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\HeaderUtils;

/** A file handed out by an action (PDF, XML, template ZIP) as download. */
final class FileResponse
{
    public static function download(DownloadFile $file, bool $inline = false): Response
    {
        return new Response($file->contents, 200, [
            'Content-Type' => $file->mimeType,
            'Content-Disposition' => HeaderUtils::makeDisposition(
                $inline ? HeaderUtils::DISPOSITION_INLINE : HeaderUtils::DISPOSITION_ATTACHMENT,
                $file->filename,
            ),
            'Content-Length' => (string) strlen($file->contents),
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
