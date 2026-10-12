<?php

namespace App\Support;

use App\Enums\DocumentType;
use App\Models\Document;
use Brick\Math\BigDecimal;
use Illuminate\Database\Eloquent\Builder;

/**
 * What is left of an invoice after its finalized cancellations (review M1): gross total plus their (negative) gross
 * totals. A partial cancellation leaves the invoice open with this smaller amount; one that covers the rest cancels it.
 * Used for the open amounts of the overview, the customer list, the document list and its sum.
 */
final class InvoiceBalance
{
    /** Attribute that DocumentQuery-style lists load with withCancelled(). */
    public const ATTRIBUTE = 'cancelled_total';

    /** The balance of the documents row in SQL (for sums over invoices). */
    public const SQL = "(documents.gross_total + COALESCE((SELECT SUM(c.gross_total) FROM documents AS c WHERE c.source_id = documents.id AND c.type = 'cancellation' AND c.finalized_at IS NOT NULL), 0))";

    /**
     * Loads the sum of finalized cancellations per row, so of() needs no extra query.
     *
     * @param  Builder<Document>  $query
     * @return Builder<Document>
     */
    public static function withCancelled(Builder $query): Builder
    {
        return $query->withSum(['cancellations as '.self::ATTRIBUTE => fn ($cancellations) => $cancellations->whereNotNull('finalized_at')], 'gross_total');
    }

    /** Balance of a finalized invoice as money string; null for other documents and drafts. */
    public static function of(Document $document): ?string
    {
        if ($document->type !== DocumentType::Invoice || ! $document->isFinalized()) {
            return null;
        }
        $attributes = $document->getAttributes();
        $cancelled = array_key_exists(self::ATTRIBUTE, $attributes)
            ? $attributes[self::ATTRIBUTE]
            : $document->cancellations()->whereNotNull('finalized_at')->sum('gross_total');

        return (string) BigDecimal::of(Amount::of((string) $document->gross_total))->plus(BigDecimal::of(Amount::of($cancelled)));
    }

    /**
     * The balance read with a locking read (finalizing a cancellation: sees cancellations committed meanwhile and
     * keeps others from finalizing one at the same time – the invoice row is locked by the caller as well).
     */
    public static function locked(Document $invoice): BigDecimal
    {
        $cancelled = Document::query()
            ->where('source_id', $invoice->id)
            ->where('type', DocumentType::Cancellation->value)
            ->whereNotNull('finalized_at')
            ->lockForUpdate()
            ->get(['gross_total'])
            ->reduce(fn (BigDecimal $sum, Document $c): BigDecimal => $sum->plus(Amount::of((string) $c->gross_total)), BigDecimal::zero());

        return BigDecimal::of(Amount::of((string) $invoice->gross_total))->plus($cancelled);
    }
}
