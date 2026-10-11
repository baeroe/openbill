<?php

namespace App\Exceptions;

use App\Domain\Compliance\ComplianceIssue;
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
     * @return list<array{path: string, message: string}>
     */
    public function toArray(): array
    {
        return array_map(fn (ComplianceIssue $issue): array => [
            'path' => $issue->path,
            'message' => Text::t('compliance.'.$issue->rule->value, $issue->params),
        ], $this->issues);
    }

    public function status(): int
    {
        return 422;
    }
}
