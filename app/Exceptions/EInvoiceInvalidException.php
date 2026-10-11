<?php

namespace App\Exceptions;

use App\Support\Text;

/** The generated CII XML does not pass the EN 16931 schema; nothing is archived (422). */
final class EInvoiceInvalidException extends DomainActionException
{
    /**
     * @param  list<string>  $errors  schema messages
     */
    public function __construct(public readonly array $errors)
    {
        parent::__construct(Text::t('einvoice.invalid', ['errors' => implode('; ', array_slice($errors, 0, 3))]));
    }

    public function status(): int
    {
        return 422;
    }
}
