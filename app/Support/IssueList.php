<?php

namespace App\Support;

use App\Domain\Compliance\ComplianceIssue;

final class IssueList
{
    /**
     * Compliance issues as the API shows them, translated into the current app language.
     *
     * @param  list<ComplianceIssue>  $issues
     * @return list<array{path: string, message: string}>
     */
    public static function toArray(array $issues): array
    {
        return array_map(fn (ComplianceIssue $issue): array => [
            'path' => $issue->path,
            'message' => Text::t('compliance.'.$issue->rule->value, $issue->params),
        ], $issues);
    }
}
