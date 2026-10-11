<?php

namespace App\Support;

use App\Domain\Lifecycle\StatusMachine;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Document;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Figures and lists of the overview page. Phase 8 returns exactly this array from the MCP tool get-overview.
 * Sums come from the stored document totals (drafts keep them current on every save) and stay strings.
 */
final class Overview
{
    public const ATTENTION_LIMIT = 8;

    public const RECENT_LIMIT = 6;

    /** Open offers whose validity ends within this many days need attention. */
    public const EXPIRY_DAYS = 7;

    /**
     * @return array{
     *     figures: array{open: array{gross: string, count: int}, overdue: array{gross: string, count: int}, offers: array{gross: string, count: int}, paid_month: array{gross: string, count: int}, paid_year: array{gross: string, count: int}},
     *     attention: list<array<string, mixed>>,
     *     attention_count: int,
     *     recent: list<array<string, mixed>>
     * }
     */
    public static function build(CarbonImmutable $today): array
    {
        $day = $today->toDateString();
        [$attention, $attentionCount] = self::attention($today);

        return [
            'figures' => [
                'open' => self::figure(self::openInvoices()),
                'overdue' => self::figure(self::overdueInvoices($day)),
                'offers' => self::figure(self::openOffers()),
                'paid_month' => self::figure(self::paidInvoices()->whereBetween('paid_at', [$today->startOfMonth(), $today->endOfMonth()])),
                'paid_year' => self::figure(self::paidInvoices()->whereBetween('paid_at', [$today->startOfYear(), $today->endOfYear()])),
            ],
            'attention' => $attention,
            'attention_count' => $attentionCount,
            'recent' => self::withCustomer(Document::query())
                ->orderByDesc('updated_at')->orderByDesc('id')
                ->limit(self::RECENT_LIMIT)->get()
                ->map(fn (Document $document): array => self::row($document, $day))
                ->values()->all(),
        ];
    }

    /**
     * Open invoices per customer (customer list): gross sum, count and how many are overdue.
     *
     * @return array<string, array{gross: string, count: int, overdue: int}>
     */
    public static function openByCustomer(CarbonImmutable $today): array
    {
        $rows = self::openInvoices()->whereNotNull('customer_id')->toBase()
            ->selectRaw('customer_id, COUNT(*) as aggregate, SUM(gross_total) as gross')
            ->groupBy('customer_id')
            ->get();
        // overdue through the one rule of DocumentQuery, not a second copy of it in SQL
        $overdue = self::overdueInvoices($today->toDateString())->whereNotNull('customer_id')->toBase()
            ->selectRaw('customer_id, COUNT(*) as aggregate')
            ->groupBy('customer_id')
            ->pluck('aggregate', 'customer_id');

        $result = [];
        foreach ($rows as $row) {
            $row = (array) $row;
            $id = (string) $row['customer_id'];
            $result[$id] = ['gross' => Amount::of($row['gross']), 'count' => (int) $row['aggregate'], 'overdue' => (int) ($overdue[$id] ?? 0)];
        }

        return $result;
    }

    /**
     * Overdue invoices first (oldest due date), then open offers that expired or expire within EXPIRY_DAYS
     * (expired first), then drafts (changed last first).
     *
     * @return array{0: list<array<string, mixed>>, 1: int}
     */
    private static function attention(CarbonImmutable $today): array
    {
        $day = $today->toDateString();
        $overdue = self::overdueInvoices($day);
        $offers = self::openOffers()->whereNotNull('valid_until')->where('valid_until', '<=', $today->addDays(self::EXPIRY_DAYS)->toDateString());
        $drafts = Document::query()->where('status', DocumentStatus::Draft->value);

        $rows = [
            ...self::withCustomer(clone $overdue)->orderBy('due_date')->orderBy('id')->limit(self::ATTENTION_LIMIT)->get()
                ->map(fn (Document $d): array => self::row($d, $day, 'overdue', $d->due_date?->toDateString())),
            ...self::withCustomer(clone $offers)->orderBy('valid_until')->orderBy('id')->limit(self::ATTENTION_LIMIT)->get()
                ->map(fn (Document $d): array => self::row($d, $day, $d->valid_until !== null && $d->valid_until->toDateString() < $day ? 'offer_expired' : 'offer_expiring', $d->valid_until?->toDateString())),
            ...self::withCustomer(clone $drafts)->orderByDesc('updated_at')->orderByDesc('id')->limit(self::ATTENTION_LIMIT)->get()
                ->map(fn (Document $d): array => self::row($d, $day, 'draft', $d->updated_at?->toDateString())),
        ];

        return [array_slice($rows, 0, self::ATTENTION_LIMIT), $overdue->count() + $offers->count() + $drafts->count()];
    }

    /**
     * @return array<string, mixed>
     */
    private static function row(Document $document, string $today, ?string $reason = null, ?string $reasonDate = null): array
    {
        return [
            'id' => $document->id,
            'type' => $document->type->value,
            'status' => $document->status->value,
            'number' => $document->number,
            'customer_name' => $document->customer?->name,
            'gross_total' => Amount::of((string) $document->gross_total),
            'is_overdue' => StatusMachine::isOverdue($document->type, $document->status, $document->due_date?->toDateString(), $today),
            'reason' => $reason,
            'reason_date' => $reasonDate,
        ];
    }

    /**
     * @param  Builder<Document>  $query
     * @return array{gross: string, count: int}
     */
    private static function figure(Builder $query): array
    {
        $row = (array) ($query->toBase()->selectRaw('COUNT(*) as aggregate, SUM(gross_total) as gross')->first() ?? []);

        return ['gross' => Amount::of($row['gross'] ?? null), 'count' => (int) ($row['aggregate'] ?? 0)];
    }

    /**
     * @param  Builder<Document>  $query
     * @return Builder<Document>
     */
    private static function withCustomer(Builder $query): Builder
    {
        return $query->with(['customer' => fn ($customer) => $customer->withTrashed()]);
    }

    /** @return Builder<Document> */
    private static function openInvoices(): Builder
    {
        return Document::query()->where('type', DocumentType::Invoice->value)->where('status', DocumentStatus::Open->value);
    }

    /**
     * Open invoices past their due date: the filter "overdue" of the document list (same rule as StatusMachine::isOverdue).
     *
     * @return Builder<Document>
     */
    private static function overdueInvoices(string $today): Builder
    {
        return DocumentQuery::filtered(['status' => DocumentQuery::OVERDUE], $today);
    }

    /** @return Builder<Document> */
    private static function openOffers(): Builder
    {
        return Document::query()->where('type', DocumentType::Offer->value)->where('status', DocumentStatus::Open->value);
    }

    /** @return Builder<Document> */
    private static function paidInvoices(): Builder
    {
        return Document::query()->where('type', DocumentType::Invoice->value)->where('status', DocumentStatus::Paid->value);
    }
}
