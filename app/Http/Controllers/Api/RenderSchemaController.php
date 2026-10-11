<?php

namespace App\Http\Controllers\Api;

use App\Actions\DescribeRenderSchema;
use App\Http\Api\ApiJson;
use App\Http\Api\CurrentActor;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** GET /api/render/schema */
final class RenderSchemaController extends Controller
{
    public function __invoke(Request $request, DescribeRenderSchema $schema): JsonResponse
    {
        return ApiJson::ok($schema->handle(CurrentActor::from($request), $request->query()));
    }
}
