<?php

namespace App\Exceptions;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Support\Text;

/** The action contradicts the document lifecycle (409). $reason is stable for API/MCP clients. */
final class ActionNotAllowedException extends DomainActionException
{
    private function __construct(public readonly string $reason, string $message)
    {
        parent::__construct($message);
    }

    public static function statusTransition(DocumentStatus $from, DocumentStatus $to): self
    {
        return new self('status_transition', Text::t('errors.status_transition', ['from' => $from->value, 'to' => $to->value]));
    }

    public static function conversion(DocumentType $from, DocumentType $to): self
    {
        return new self('conversion', Text::t('errors.conversion', ['from' => $from->value, 'to' => $to->value]));
    }

    public static function duplicateCancellation(): self
    {
        return new self('duplicate_cancellation', Text::t('errors.duplicate_cancellation'));
    }

    public static function cancellationNeedsInvoice(): self
    {
        return new self('cancellation_needs_invoice', Text::t('errors.cancellation_needs_invoice'));
    }

    public static function cancellationSource(): self
    {
        return new self('cancellation_source', Text::t('errors.cancellation_source'));
    }

    /** No archived e-invoice XML: not finalized, or not an EN 16931 invoice/cancellation. */
    public static function noEInvoice(): self
    {
        return new self('no_e_invoice', Text::t('errors.no_e_invoice'));
    }

    /** A cancellation always belongs to the customer of its invoice. */
    public static function cancellationCustomer(): self
    {
        return new self('cancellation_customer', Text::t('errors.cancellation_customer'));
    }

    public static function customerHasFinalizedDocuments(): self
    {
        return new self('customer_has_finalized_documents', Text::t('errors.customer_has_finalized_documents'));
    }

    public function status(): int
    {
        return 409;
    }
}
