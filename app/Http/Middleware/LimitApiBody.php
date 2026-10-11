<?php

namespace App\Http\Middleware;

use App\Support\Text;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Refuses request bodies above config('openbill.api.*') with 413 (Problem Details) before anything parses
 * them: by Content-Length and by what was actually received (chunked bodies send no Content-Length).
 * Template uploads get the larger limit.
 */
final class LimitApiBody
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $limit = self::limit($request);

        $declared = $request->headers->get('Content-Length');
        if ($declared !== null && (int) $declared > $limit) {
            self::refuse($limit);
        }

        // multipart bodies are parsed by PHP into files, everything else is read as raw content
        $received = strlen((string) $request->getContent());
        foreach ($request->allFiles() as $file) {
            foreach (is_array($file) ? $file : [$file] as $upload) {
                $received += (int) $upload->getSize();
            }
        }
        if ($received > $limit) {
            self::refuse($limit);
        }

        return $next($request);
    }

    public static function limit(Request $request): int
    {
        $template = ($request->isMethod('POST') && $request->is('api/templates'))
            || ($request->isMethod('PUT') && $request->is('api/templates/*/files'));

        return (int) config($template ? 'openbill.api.max_template_body_bytes' : 'openbill.api.max_body_bytes');
    }

    private static function refuse(int $limit): never
    {
        throw new HttpException(413, Text::t('api.problem.body_too_large', ['mb' => max(1, intdiv($limit, 1024 * 1024))]));
    }
}
