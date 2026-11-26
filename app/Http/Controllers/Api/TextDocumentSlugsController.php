<?php

namespace App\Http\Controllers\Api;

use App\Actions\ListTextDocumentSlugs;
use App\Http\Api\ApiJson;
use App\Http\Api\CurrentActor;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** GET /api/text-documents/slugs – the short names an attachment can use (document editor, settings). */
final class TextDocumentSlugsController extends Controller
{
    public function __invoke(Request $request, ListTextDocumentSlugs $list): JsonResponse
    {
        return ApiJson::ok($list->handle(CurrentActor::from($request)));
    }
}
