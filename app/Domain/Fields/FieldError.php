<?php

namespace App\Domain\Fields;

final readonly class FieldError
{
    /**
     * @param  string  $path  dot path in the action input, e.g. "custom.po_number"
     * @param  array<string, string>  $params  placeholders for the message (:label, :key, :options)
     */
    public function __construct(
        public string $path,
        public FieldErrorCode $code,
        public array $params = [],
    ) {}
}
