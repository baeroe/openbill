<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * An action refused to run. App\Support\Problem turns it into Problem Details (REST) and MCP tool
 * errors (phase 8): status() is the HTTP status, reason() a stable code, extensions() extra members.
 */
abstract class DomainActionException extends RuntimeException
{
    abstract public function status(): int;

    abstract public function reason(): string;

    /**
     * @return array<string, mixed>
     */
    public function extensions(): array
    {
        return [];
    }
}
