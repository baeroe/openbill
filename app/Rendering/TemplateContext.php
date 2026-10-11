<?php

namespace App\Rendering;

use App\Domain\Totals\Totals;

final readonly class TemplateContext
{
    /**
     * @param  array<string, mixed>  $data  Liquid variables (raw, not escaped)
     */
    public function __construct(
        public array $data,
        public Totals $totals,
    ) {}
}
