<?php

namespace App\Http\Controllers\Api;

use App\Actions\DocumentXml;
use App\Http\Api\CurrentActor;
use App\Http\Api\FileResponse;
use App\Http\Controllers\Controller;
use App\Models\Document;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** GET /api/documents/{id}/xml – archived EN 16931 XML (409 no_e_invoice otherwise). */
final class DocumentXmlController extends Controller
{
    public function __invoke(Request $request, DocumentXml $xml): Response
    {
        $document = Document::query()->findOrFail((string) $request->route('id'));

        return FileResponse::download($xml->handle(CurrentActor::from($request), $document));
    }
}
