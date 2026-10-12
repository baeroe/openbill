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
     * @param  array<string, mixed>  $manifest  the manifest of the template that was rendered (not part of toArray())
     */
    public function __construct(
        public RenderResult $render,
        public Totals $totals,
        public array $issues = [],
        public array $manifest = [],
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
