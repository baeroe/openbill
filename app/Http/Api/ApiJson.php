<?php

namespace App\Http\Api;

use Illuminate\Http\JsonResponse;

/** Plain JSON answers of the routes in routes/api.php (action results as they are). */
final class ApiJson
{
    public static function ok(mixed $data, int $status = 200): JsonResponse
    {
        return new JsonResponse($data, $status, [], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}
