<?php

namespace App\Rendering;

use App\Models\Document;

final readonly class SampleData
{
    /**
     * @param  Document  $document  in-memory document with groups and positions, never saved
     * @param  array<string, mixed>  $sources  snapshot-shaped master data
     */
    public function __construct(
        public Document $document,
        public array $sources,
    ) {}
}
