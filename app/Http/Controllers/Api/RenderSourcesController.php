<?php

namespace App\Http\Controllers\Api;

use App\Actions\ListRenderSources;
use App\Http\Api\ApiJson;
use App\Http\Api\CurrentActor;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** GET /api/render/sources */
final class RenderSourcesController extends Controller
{
    public function __invoke(Request $request, ListRenderSources $sources): JsonResponse
    {
        return ApiJson::ok($sources->handle(CurrentActor::from($request), $request->query()));
    }
}
