<?php

namespace App\Http\Controllers\Api;

use App\Actions\SuggestPositions;
use App\Http\Api\ApiJson;
use App\Http\Api\CurrentActor;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** GET /api/position-suggestions (document editor, phase 6) */
final class PositionSuggestionsController extends Controller
{
    public function __invoke(Request $request, SuggestPositions $suggest): JsonResponse
    {
        return ApiJson::ok($suggest->handle(CurrentActor::from($request), $request->query()));
    }
}
