<?php

namespace App\Http;

use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Request as SymfonyRequest;

/**
 * The request of public/index.php. Unlike Request::capture() it does not decode a JSON body when it is
 * created: App\Http\Middleware\LimitApiBody checks the size first and then calls decodeJsonBody(), so a
 * huge JSON body ends in 413 instead of exhausting the memory.
 */
final class IncomingRequest extends Request
{
    public static function capture(): static
    {
        self::enableHttpMethodParameterOverride();

        return self::fromBase(SymfonyRequest::createFromGlobals());
    }

    /** Request::createFromBase() without decoding the JSON body. */
    public static function fromBase(SymfonyRequest $base): static
    {
        $request = new self(
            $base->query->all(), $base->request->all(), $base->attributes->all(),
            $base->cookies->all(), (new self)->filterFiles($base->files->all()) ?? [], $base->server->all(),
        );
        $request->headers->replace($base->headers->all());
        $request->content = $base->content;

        return $request;
    }

    /** What Request::createFromBase() does on creation: a JSON body becomes the request parameters. */
    public function decodeJsonBody(): void
    {
        if ($this->isJson()) {
            $this->request->replace($this->json()->all());
            $this->setJson($this->request);
        }
    }

    public function jsonDecoded(): bool
    {
        return isset($this->json);
    }
}
