<?php

namespace App\Mcp;

use App\Exceptions\DomainActionException;
use App\Support\Problem;
use App\Support\Text;
use Illuminate\Validation\ValidationException;

/**
 * Tool errors an agent can act on: every invalid field with its path (laravel/mcp would drop the paths) and
 * refusals of the actions with their stable reason and extra members (e.g. the compliance issues).
 */
final class ToolErrors
{
    public static function validation(ValidationException $e): string
    {
        $lines = [];
        foreach ($e->errors() as $path => $messages) {
            foreach ($messages as $message) {
                $lines[] = "- {$path}: {$message}";
            }
        }

        return Text::t('mcp.invalid_input')."\n".implode("\n", $lines);
    }

    public static function domain(DomainActionException $e): string
    {
        $problem = Problem::fromThrowable($e);
        $text = "{$problem->detail} (reason: {$problem->reason})";

        return $problem->extensions === []
            ? $text
            : $text."\n".json_encode($problem->extensions, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}
