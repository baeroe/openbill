<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\Response;

/**
 * Admin URLs carry the language as /en|/de prefix; it is remembered in the cookie `locale`,
 * which unprefixed entry points (/ and /login) use. Default: English, never the browser language.
 */
class SetLocale
{
    /** @var list<string> */
    public const array LOCALES = ['en', 'de'];

    /**
     * The language of this request. Also usable before this middleware ran
     * (auth runs earlier because of the middleware priority).
     */
    public static function fromRequest(Request $request): string
    {
        $resolved = $request->attributes->get('locale');
        if (is_string($resolved)) {
            return $resolved;
        }

        $route = $request->route();
        $prefix = $route instanceof Route ? $route->parameter('locale') : null;
        if (is_string($prefix) && in_array($prefix, self::LOCALES, true)) {
            return $prefix;
        }

        $cookie = $request->cookie('locale');

        return is_string($cookie) && in_array($cookie, self::LOCALES, true) ? $cookie : 'en';
    }

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $locale = self::fromRequest($request);
        $route = $request->route();
        $fromPrefix = $route instanceof Route && $route->hasParameter('locale');

        app()->setLocale($locale);
        URL::defaults(['locale' => $locale]);
        $request->attributes->set('locale', $locale);
        // controllers never get the prefix as an argument (it would shift model bindings)
        if ($route instanceof Route) {
            $route->forgetParameter('locale');
        }

        $response = $next($request);

        if ($fromPrefix && $request->cookie('locale') !== $locale) {
            $response->headers->setCookie(cookie()->forever('locale', $locale));
        }

        return $response;
    }
}
