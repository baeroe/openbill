<?php

namespace App\Rendering\Liquid;

/** What filters need besides the value: document language and the template's own translations (register "openbill"). */
final readonly class RenderEnv
{
    public const REGISTER = 'openbill';

    /**
     * @param  array<string, array<string, string>>  $translations  manifest "translations" by locale
     */
    public function __construct(
        public string $locale,
        public array $translations = [],
    ) {}
}
