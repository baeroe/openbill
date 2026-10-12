<?php

namespace App\Http\Middleware;

use App\Http\IncomingRequest;
use App\Support\Text;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Refuses /api and /mcp request bodies above config('openbill.api.*') with 413 (Problem Details). Runs as the first
 * global middleware – before ValidatePostSize and TrimStrings, which would decode a JSON body completely;
 * the request itself is created without decoding JSON (App\Http\IncomingRequest, public/index.php) and
 * decoded here once the size is fine. It never parses the body itself: it checks Content-Length, then reads the raw body as a stream up to
 * the limit (chunked bodies send no Content-Length). Form and multipart bodies are already parsed by PHP;
 * their fields and files are counted. Template uploads get the larger limit.
 */
final class LimitApiBody
{
    private const CHUNK = 65536;

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->is('api', 'api/*', 'mcp')) {
            self::check($request, self::limit($request));
        }

        // public/index.php creates the request without decoding JSON; now that the size is fine, do it
        if ($request instanceof IncomingRequest) {
            $request->decodeJsonBody();
        }

        return $next($request);
    }

    private static function check(Request $request, int $limit): void
    {

        $declared = $request->server->get('CONTENT_LENGTH', $request->headers->get('Content-Length'));
        if (is_numeric($declared) && (int) $declared > $limit) {
            self::refuse($limit);
        }

        if (self::parsedByPhp($request)) {
            // PHP filled $_POST/$_FILES already (up to post_max_size); count what it parsed
            $received = strlen(http_build_query($request->request->all()));
            $received += self::fileBytes($request->files->all());
        } else {
            $received = self::streamedLength($request, $limit);
        }
        if ($received > $limit) {
            self::refuse($limit);
        }
    }

    public static function limit(Request $request): int
    {
        $template = ($request->isMethod('POST') && $request->is('api/templates'))
            || ($request->isMethod('PUT') && $request->is('api/templates/*/files'));

        return (int) config($template ? 'openbill.api.max_template_body_bytes' : 'openbill.api.max_body_bytes');
    }

    /**
     * @param  array<array-key, mixed>  $files
     */
    private static function fileBytes(array $files): int
    {
        $bytes = 0;
        foreach ($files as $file) {
            $bytes += is_array($file) ? self::fileBytes($file) : ($file instanceof UploadedFile ? (int) $file->getSize() : 0);
        }

        return $bytes;
    }

    private static function parsedByPhp(Request $request): bool
    {
        $type = strtolower((string) $request->headers->get('Content-Type'));

        return str_starts_with($type, 'multipart/form-data') || str_starts_with($type, 'application/x-www-form-urlencoded');
    }

    /** Bytes of the raw body, read in chunks and at most up to $limit + 1 (php://input can be read again later). */
    private static function streamedLength(Request $request, int $limit): int
    {
        $stream = $request->getContent(true);
        $length = 0;
        while (! feof($stream) && $length <= $limit) {
            $chunk = fread($stream, self::CHUNK);
            if ($chunk === false) {
                break;
            }
            $length += strlen($chunk);
        }
        rewind($stream);

        return $length;
    }

    private static function refuse(int $limit): never
    {
        throw new HttpException(413, Text::t('api.problem.body_too_large', ['mb' => max(1, intdiv($limit, 1024 * 1024))]));
    }
}
