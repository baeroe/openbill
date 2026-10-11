<?php

namespace App\Exceptions;

use App\Models\Document;
use App\Support\Text;

/** Finalized documents are immutable except status, paid_at and cancelled_by_id (GoBD). */
final class DocumentLockedException extends DomainActionException
{
    /**
     * @param  list<string>  $fields  columns that were about to change
     */
    public function __construct(
        public readonly string $documentId,
        public readonly ?string $number,
        public readonly array $fields = [],
    ) {
        parent::__construct(Text::t('errors.document_locked', ['number' => $number ?? $documentId]));
    }

    /**
     * @param  list<string>  $fields
     */
    public static function for(Document $document, array $fields = []): self
    {
        return new self($document->id, $document->getOriginal('number') ?? $document->number, $fields);
    }

    public function status(): int
    {
        return 409;
    }
}
