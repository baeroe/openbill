<?php

namespace App\Http\Controllers\Api;

use App\Actions\DocumentPdf;
use App\Http\Api\CurrentActor;
use App\Http\Api\FileResponse;
use App\Http\Controllers\Controller;
use App\Models\Document;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** GET /api/documents/{id}/pdf – finalized: archived file; draft: live with watermark. */
final class DocumentPdfController extends Controller
{
    public function __invoke(Request $request, DocumentPdf $pdf): Response
    {
        $document = Document::query()->findOrFail((string) $request->route('id'));

        return FileResponse::download($pdf->handle(CurrentActor::from($request), $document), $request->boolean('inline'));
    }
}
