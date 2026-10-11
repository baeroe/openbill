<?php

namespace App\Support;

use ApiPlatform\Laravel\ApiResource\ValidationError;
use ApiPlatform\Metadata\Exception\HttpExceptionInterface as ApiPlatformHttpException;
use App\Exceptions\DomainActionException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * One error format for REST (application/problem+json, RFC 9457) and MCP tool errors (phase 8):
 * {type: "urn:openbill:problem:<reason>", title, status, detail, reason, …extension members}.
 * Server errors (5xx) never show internals unless $debug.
 */
final readonly class Problem
{
    /** Title per HTTP status: translation key api.problem.<slug> (other statuses: http_error). */
    public const SLUGS = [
        400 => 'bad_request', 401 => 'unauthenticated', 403 => 'forbidden', 404 => 'not_found',
        405 => 'method_not_allowed', 406 => 'not_acceptable', 409 => 'conflict', 413 => 'payload_too_large',
        415 => 'unsupported_media_type', 419 => 'csrf_token_mismatch', 422 => 'unprocessable',
        429 => 'too_many_requests', 500 => 'server_error', 503 => 'service_unavailable',
    ];

    /**
     * @param  array<string, mixed>  $extensions
     * @param  array<string, mixed>  $headers
     */
    public function __construct(
        public int $status,
        public string $reason,
        public string $detail,
        public array $extensions = [],
        public array $headers = [],
    ) {}

    public static function fromThrowable(Throwable $e, bool $debug = false): self
    {
        return match (true) {
            $e instanceof ValidationException => new self(422, 'validation_failed', $e->getMessage(), ['violations' => self::violations($e)]),
            $e instanceof ValidationError => new self(422, 'validation_failed', $e->getDetail() ?? '', ['violations' => array_map(
                fn (array $v): array => ['path' => $v['propertyPath'], 'message' => $v['message']],
                $e->getViolations(),
            )]),
            $e instanceof DomainActionException => new self($e->status(), $e->reason(), $e->getMessage(), $e->extensions()),
            $e instanceof AuthenticationException => new self(401, 'unauthenticated', Text::t('api.problem.unauthenticated')),
            $e instanceof HttpExceptionInterface => self::http($e->getStatusCode(), $e->getMessage(), $e->getHeaders()),
            $e instanceof ApiPlatformHttpException => self::http($e->getStatusCode(), $e->getMessage(), $e->getHeaders()),
            default => new self(500, 'server_error', $debug ? $e->getMessage() : Text::t('api.problem.server_error_detail')),
        };
    }

    public function title(): string
    {
        return Text::t('api.problem.'.(self::SLUGS[$this->status] ?? 'http_error'));
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'type' => 'urn:openbill:problem:'.$this->reason,
            'title' => $this->title(),
            'status' => $this->status,
            'detail' => $this->detail,
            'reason' => $this->reason,
            ...$this->extensions,
        ];
    }

    /**
     * @param  array<string, mixed>  $headers
     */
    private static function http(int $status, string $message, array $headers): self
    {
        $slug = self::SLUGS[$status] ?? 'http_error';
        // 404 messages name model classes ("No query results for model …"), 5xx ones internals
        $detail = $message !== '' && $status !== 404 && $status < 500 ? $message : Text::t("api.problem.{$slug}");

        return new self($status, $slug, $detail, [], $headers);
    }

    /**
     * @return list<array{path: string, message: string}>
     */
    private static function violations(ValidationException $e): array
    {
        $list = [];
        foreach ($e->errors() as $path => $messages) {
            foreach ($messages as $message) {
                $list[] = ['path' => (string) $path, 'message' => $message];
            }
        }

        return $list;
    }
}
