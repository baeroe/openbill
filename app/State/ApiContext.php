<?php

namespace App\State;

use App\Http\Api\CurrentActor;
use App\Http\Api\RequestBody;
use App\Support\Actor;
use Illuminate\Http\Request;
use LogicException;

/** The Laravel request, the actor and the raw JSON body from API Platform's provider/processor context. */
final class ApiContext
{
    /**
     * @param  array<string, mixed>  $context
     */
    public static function request(array $context): Request
    {
        $request = $context['request'] ?? null;
        if (! $request instanceof Request) {
            throw new LogicException('API Platform did not pass the request in the context.');
        }

        return $request;
    }

    /**
     * @param  array<string, mixed>  $context
     */
    public static function actor(array $context): Actor
    {
        return CurrentActor::from(self::request($context));
    }

    /**
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    public static function body(array $context): array
    {
        return RequestBody::object(self::request($context));
    }
}
