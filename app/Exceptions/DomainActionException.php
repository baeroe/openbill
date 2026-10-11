<?php

namespace App\Exceptions;

use RuntimeException;

/** An action refused to run. The API (phase 4) maps status() to Problem Details, MCP (phase 8) to a tool error. */
abstract class DomainActionException extends RuntimeException
{
    abstract public function status(): int;
}
