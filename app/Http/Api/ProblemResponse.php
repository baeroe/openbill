<?php

namespace App\Http\Api;

use App\Support\Problem;
use Illuminate\Http\JsonResponse;
use Throwable;

/** Renders every exception of an /api route as application/problem+json (bootstrap/app.php). */
final class ProblemResponse
{
    public static function from(Throwable $e): JsonResponse
    {
        $problem = Problem::fromThrowable($e, (bool) config('app.debug'));

        return new JsonResponse(
            $problem->toArray(),
            $problem->status,
            [...$problem->headers, 'Content-Type' => 'application/problem+json'],
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE,
        );
    }
}
