<?php

namespace App\Actions;

use App\Enums\DocumentType;
use App\Exceptions\ActionNotAllowedException;
use App\Models\Document;
use App\Support\Actor;
use App\Support\ConversionResult;

/** Creates (or returns) the cancellation draft of an open or paid invoice; finalizing it cancels the invoice. */
final class CancelInvoice
{
    public function __construct(private readonly ConvertDocument $convert) {}

    /**
     * @throws ActionNotAllowedException
     */
    public function handle(Actor $actor, Document $invoice): ConversionResult
    {
        if ($invoice->type !== DocumentType::Invoice) {
            throw ActionNotAllowedException::conversion($invoice->type, DocumentType::Cancellation);
        }

        return $this->convert->handle($actor, $invoice, DocumentType::Cancellation);
    }
}
