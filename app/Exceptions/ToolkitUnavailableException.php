<?php

namespace App\Exceptions;

use App\Support\Text;

/** The built template kit (config openbill.toolkit.path) is missing: `pnpm build` did not run (503). */
final class ToolkitUnavailableException extends DomainActionException
{
    public function __construct()
    {
        parent::__construct(Text::t('errors.toolkit_unavailable'));
    }

    public function status(): int
    {
        return 503;
    }

    public function reason(): string
    {
        return 'toolkit_unavailable';
    }
}
