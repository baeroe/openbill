<?php

namespace App\Domain\Compliance;

final readonly class ComplianceIssue
{
    /**
     * @param  string  $path  points at the field in the editor (jump target), e.g. "positions.<id>.unit"
     * @param  array<string, string>  $params  placeholders for the message (:title, :label)
     */
    public function __construct(
        public string $path,
        public ComplianceRule $rule,
        public array $params = [],
    ) {}
}
