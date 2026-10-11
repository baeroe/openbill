<?php

namespace App\Support;

use App\Domain\Compliance\ComplianceIssue;

final class IssueList
{
    /**
     * Compliance issues as the API shows them, translated into the current app language;
     * code is the stable rule (App\Domain\Compliance\ComplianceRule) for API/MCP clients.
     *
     * @param  list<ComplianceIssue>  $issues
     * @return list<array{path: string, message: string, code: string}>
     */
    public static function toArray(array $issues): array
    {
        return array_map(fn (ComplianceIssue $issue): array => [
            'path' => $issue->path,
            'message' => Text::t('compliance.'.$issue->rule->value, $issue->params),
            'code' => $issue->rule->value,
        ], $issues);
    }
}
