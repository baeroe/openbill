<?php

namespace Tests\Support;

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

/**
 * Gotenberg for feature tests. The fake PDF depends on the request body, so a second rendering of
 * changed data gives different bytes (tests can tell an archived file from a fresh render).
 * Integration tests (tests/Integration) talk to the real service instead.
 */
final class GotenbergFake
{
    private static string $mode = 'ok';

    public static function install(): void
    {
        self::$mode = 'ok';
        Http::preventStrayRequests();
        Http::fake(function (Request $request) {
            if (! str_contains($request->url(), '/forms/chromium/convert/html')) {
                return null; // stray request → exception
            }

            return match (self::$mode) {
                'error' => Http::response('Chromium failed to convert the page', 500),
                'html' => Http::response('<html>proxy error page</html>', 200),
                'timeout' => Http::failedConnection('cURL error 28: Operation timed out after 20001 milliseconds')($request),
                default => Http::response(self::pdfFor($request->body()), 200, ['Content-Type' => 'application/pdf']),
            };
        });
    }

    public static function pdfFor(string $requestBody): string
    {
        return "%PDF-1.7\n% fake ".md5($requestBody)."\n%%EOF\n";
    }

    public static function failWithError(): void
    {
        self::$mode = 'error';
    }

    public static function timeOut(): void
    {
        self::$mode = 'timeout';
    }

    /** 200 with something that is no PDF (e.g. a proxy page). */
    public static function answerWithHtml(): void
    {
        self::$mode = 'html';
    }

    public static function succeed(): void
    {
        self::$mode = 'ok';
    }
}
