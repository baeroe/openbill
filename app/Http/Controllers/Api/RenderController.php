<?php

namespace App\Http\Controllers\Api;

use App\Actions\RenderPreview;
use App\Http\Api\ApiJson;
use App\Http\Api\CurrentActor;
use App\Http\Api\RequestBody;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** POST /api/render – PreviewResult::toArray(); template problems are part of the answer (200). */
final class RenderController extends Controller
{
    public function __invoke(Request $request, RenderPreview $preview): JsonResponse
    {
        return ApiJson::ok($preview->handle(CurrentActor::from($request), RequestBody::object($request))->toArray());
    }
}
