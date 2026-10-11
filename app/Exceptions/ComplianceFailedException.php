<?php

namespace App\Exceptions;

use App\Domain\Compliance\ComplianceIssue;
use App\Support\IssueList;
use App\Support\Text;

/** Finalizing stopped because the profile check is not green (422 with the issue list). */
final class ComplianceFailedException extends DomainActionException
{
    /**
     * @param  list<ComplianceIssue>  $issues
     */
    public function __construct(public readonly array $issues)
    {
        parent::__construct(Text::t('compliance.failed', ['count' => count($issues)]));
    }

    /**
     * @return list<array{path: string, message: string, code: string}>
     */
    public function toArray(): array
    {
        return IssueList::toArray($this->issues);
    }

    public function reason(): string
    {
        return 'compliance_failed';
    }

    /**
     * @return array{violations: list<array{path: string, message: string, code: string}>}
     */
    public function extensions(): array
    {
        return ['violations' => $this->toArray()];
    }

    public function status(): int
    {
        return 422;
    }
}
