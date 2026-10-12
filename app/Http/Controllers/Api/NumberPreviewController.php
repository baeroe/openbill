<?php

namespace App\Http\Controllers\Api;

use App\Actions\PreviewDocumentNumber;
use App\Enums\DocumentType;
use App\Http\Api\ApiJson;
use App\Http\Api\CurrentActor;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** GET /api/document-types/{type}/number-preview?pattern=&reset_yearly=&next_value= */
final class NumberPreviewController extends Controller
{
    public function __invoke(Request $request, PreviewDocumentNumber $preview): JsonResponse
    {
        $type = DocumentType::tryFrom((string) $request->route('type')) ?? abort(404);

        return ApiJson::ok($preview->handle(CurrentActor::from($request), $type, $request->query()));
    }
}
