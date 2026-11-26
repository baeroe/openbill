<?php

namespace App\Support;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Document;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Text documents by short name. One resolution for everything that follows a slug: the newest finalized text document
 * without a customer (a contract of customer A must never turn up for customer B), by finalization time, then id.
 */
final class TextDocuments
{
    /** @return Builder<Document> */
    public static function finalizedWithoutCustomer(string $slug): Builder
    {
        return Document::query()
            ->where('type', DocumentType::Text->value)
            ->where('status', DocumentStatus::Closed->value)
            ->whereNull('customer_id')
            ->where('slug', $slug);
    }

    /**
     * The newest version of every short name that has one. shortcut: reads all versions and keeps the first of each
     * short name, fine for the handful of texts an instance has; use a grouped query if a lot of versions pile up.
     *
     * @return Collection<int, Document>
     */
    public static function latestPerSlug(): Collection
    {
        return Document::query()
            ->where('type', DocumentType::Text->value)
            ->where('status', DocumentStatus::Closed->value)
            ->whereNull('customer_id')
            ->whereNotNull('slug')
            ->orderByDesc('finalized_at')->orderByDesc('id')
            ->get()
            ->unique('slug')
            ->sortBy('slug')
            ->values();
    }

    public static function latest(string $slug): ?Document
    {
        return self::finalizedWithoutCustomer($slug)->orderByDesc('finalized_at')->orderByDesc('id')->first();
    }
}
