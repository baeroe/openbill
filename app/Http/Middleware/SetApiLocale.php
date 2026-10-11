<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Language of API messages: Accept-Language (en|de), otherwise English. The admin UI uses SetLocale instead. */
final class SetApiLocale
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        app()->setLocale($request->getPreferredLanguage(['en', 'de']) ?? 'en');

        return $next($request);
    }
}
