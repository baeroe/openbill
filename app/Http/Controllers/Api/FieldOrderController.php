<?php

namespace App\Http\Controllers\Api;

use App\Actions\ReorderFieldDefinitions;
use App\Http\Api\CurrentActor;
use App\Http\Api\RequestBody;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** POST /api/field-definitions/reorder – {scope, ids}. */
final class FieldOrderController extends Controller
{
    public function __invoke(Request $request, ReorderFieldDefinitions $reorder): Response
    {
        $reorder->handle(CurrentActor::from($request), RequestBody::object($request));

        return response()->noContent();
    }
}
