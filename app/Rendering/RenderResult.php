<?php

namespace App\Rendering;

/**
 * Header, body and footer as three standalone HTML documents (what Gotenberg receives),
 * the paper they were laid out for, and every template problem.
 */
final readonly class RenderResult
{
    /**
     * @param  list<RenderError>  $errors
     */
    public function __construct(
        public string $header,
        public string $body,
        public string $footer,
        public Paper $paper,
        public array $errors = [],
    ) {}

    public function ok(): bool
    {
        return $this->errors === [];
    }

    /**
     * @return array{header: string, body: string, footer: string, paper: array<string, string>, errors: list<array{part: string, file: string|null, line: int|null, message: string}>}
     */
    public function toArray(): array
    {
        return [
            'header' => $this->header,
            'body' => $this->body,
            'footer' => $this->footer,
            'paper' => $this->paper->toArray(),
            'errors' => array_map(fn (RenderError $error): array => $error->toArray(), $this->errors),
        ];
    }
}
