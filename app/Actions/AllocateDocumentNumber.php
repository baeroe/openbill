<?php

namespace App\Actions;

use App\Enums\DocumentType;
use App\Support\NumberRange;
use Carbon\CarbonImmutable;

/**
 * Hands out the next number of a document type's range (NumberRange: locked until the surrounding transaction ends,
 * a rollback – failed finalize – gives the number back).
 */
final class AllocateDocumentNumber
{
    public function handle(DocumentType $type, string $date): string
    {
        return NumberRange::document($type)->allocate(CarbonImmutable::parse($date));
    }

    /**
     * The counter value the next finalize on $date would use; nothing is locked or reserved. $resetYearly overrides the
     * saved setting (settings form with an unsaved checkbox).
     */
    public function nextValue(DocumentType $type, string $date, ?bool $resetYearly = null): int
    {
        return NumberRange::document($type)->nextValue(CarbonImmutable::parse($date), $resetYearly);
    }

    /** The number the next finalize on $date would get; nothing is locked or reserved. */
    public function preview(DocumentType $type, string $date): string
    {
        return NumberRange::document($type)->preview(CarbonImmutable::parse($date));
    }
}
