<?php

namespace App\Exceptions;

use App\Support\Text;

/** Only owners manage users and invitations (403). */
final class OwnerRequiredException extends DomainActionException
{
    public function __construct()
    {
        parent::__construct(Text::t('errors.owner_required'));
    }

    public function reason(): string
    {
        return 'owner_required';
    }

    public function status(): int
    {
        return 403;
    }
}
