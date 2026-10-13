<?php

namespace App\Http\Controllers\Api;

use App\Actions\PreviewCustomerNumber;
use App\Http\Api\ApiJson;
use App\Http\Api\CurrentActor;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** GET /api/customer-numbering/preview?pattern=&reset_yearly=&next_value= */
final class CustomerNumberPreviewController extends Controller
{
    public function __invoke(Request $request, PreviewCustomerNumber $preview): JsonResponse
    {
        return ApiJson::ok($preview->handle(CurrentActor::from($request), $request->query()));
    }
}
