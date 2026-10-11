<?php

namespace App\Rendering;

final readonly class RenderOptions
{
    /**
     * @param  string  $locale  document language: filters (money, date, number, t) format in it
     * @param  string|null  $draftMark  watermark text on every page (draft PDFs), null for none
     */
    public function __construct(
        public string $locale = 'en',
        public ?string $draftMark = null,
    ) {}
}
