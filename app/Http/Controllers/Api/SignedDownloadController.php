<?php

namespace App\Http\Controllers\Api;

use App\Actions\DocumentPdf;
use App\Actions\DocumentXml;
use App\Http\Api\FileResponse;
use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Support\Actor;
use App\Support\SignedDownloads;
use App\Support\Text;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/** GET /api/downloads/documents/{id}/{kind} – the signature is the permission (App\Support\SignedDownloads). */
final class SignedDownloadController extends Controller
{
    public function __invoke(Request $request, DocumentPdf $pdf, DocumentXml $xml): Response
    {
        $document = Document::query()->findOrFail((string) $request->route('id'));
        if (! SignedDownloads::isCurrent($document, $request->query('version') === null ? null : (string) $request->query('version'))) {
            throw new AccessDeniedHttpException(Text::t('api.problem.link_outdated'));
        }
        $file = $request->route('kind') === 'xml'
            ? $xml->handle(Actor::system(), $document)
            : $pdf->handle(Actor::system(), $document);

        return FileResponse::download($file);
    }
}
