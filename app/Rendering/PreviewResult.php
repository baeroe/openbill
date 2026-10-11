<?php

namespace App\Rendering;

use App\Domain\Compliance\ComplianceIssue;
use App\Domain\Totals\Totals;
use App\Support\IssueList;

/** Answer of POST /api/render (phase 4): rendered parts, paper, template errors, totals and compliance issues. */
final readonly class PreviewResult
{
    /**
     * @param  list<ComplianceIssue>  $issues
     */
    public function __construct(
        public RenderResult $render,
        public Totals $totals,
        public array $issues = [],
    ) {}

    /**
     * @return array<string, mixed> {header, body, footer, paper, errors, totals, issues}
     */
    public function toArray(): array
    {
        return [
            ...$this->render->toArray(),
            'totals' => $this->totals->toArray(),
            'issues' => IssueList::toArray($this->issues),
        ];
    }
}
