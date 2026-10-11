<?php

namespace App\Rendering;

final readonly class RenderedDocument
{
    public function __construct(
        public string $pdf,
        public ?string $xml = null,
    ) {}
}
