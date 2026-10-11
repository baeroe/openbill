<?php

namespace App\Support;

use App\Models\Document;

final readonly class ConversionResult
{
    /**
     * @param  list<string>  $droppedFields  "document.<key>" / "position.<key>" not used by the target type
     */
    public function __construct(
        public Document $document,
        public array $droppedFields,
    ) {}
}
