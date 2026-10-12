<?php

namespace App\Mcp;

use Illuminate\Contracts\JsonSchema\JsonSchema;

/** Input schemas shared by several tools. Amounts and quantities are strings ("1130.50"), dates YYYY-MM-DD. */
final class Schemas
{
    /**
     * @return array<string, mixed>
     */
    public static function paging(JsonSchema $schema): array
    {
        return [
            'page' => $schema->integer()->description('Page, starting at 1 (default 1)'),
            'per_page' => $schema->integer()->description('Items per page, 1 to 100 (default 30)'),
        ];
    }
}
