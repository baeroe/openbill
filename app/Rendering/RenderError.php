<?php

namespace App\Rendering;

use App\Enums\RenderPart;

final readonly class RenderError
{
    public function __construct(
        public RenderPart $part,
        public ?int $line,
        public string $message,
    ) {}

    /**
     * @return array{part: string, file: string|null, line: int|null, message: string}
     */
    public function toArray(): array
    {
        return ['part' => $this->part->value, 'file' => $this->part->file(), 'line' => $this->line, 'message' => $this->message];
    }
}
