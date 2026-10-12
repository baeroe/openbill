<?php

namespace App\Support;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Document;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Filters of the document list, shared by GET /api/documents and the documents page (rows, counts, sum).
 * status "overdue" = open invoice past its due date (the rule of StatusMachine::isOverdue).
 */
final class DocumentQuery
{
    public const SORTS = ['date', 'number', 'updated_at', 'gross_total'];

    public const OVERDUE = 'overdue';

    /** Filters a page URL may carry (the API takes all rules). */
    private const PAGE_FILTERS = ['type', 'status', 'customer_id', 'q', 'date_from', 'date_to'];

    /**
     * @return array<string, list<mixed>>
     */
    public static function rules(): array
    {
        return [
            'type' => ['sometimes', Rule::enum(DocumentType::class)],
            'status' => ['sometimes', Rule::in([...array_map(fn (DocumentStatus $s): string => $s->value, DocumentStatus::cases()), self::OVERDUE])],
            'customer_id' => ['sometimes', 'string', 'max:26'],
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
            'date_from' => ['sometimes', 'date_format:Y-m-d'],
            'date_to' => ['sometimes', 'date_format:Y-m-d'],
            'sort' => ['sometimes', Rule::in([...self::SORTS, ...array_map(fn (string $s): string => "-{$s}", self::SORTS)])],
        ];
    }

    /**
     * Strict, for the API: anything invalid is a 422.
     *
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public static function validate(array $query): array
    {
        return Validator::make($query, self::rules())->validate();
    }

    /**
     * Lenient, for pages whose URLs people type and bookmark: invalid values are dropped, strings trimmed.
     *
     * @param  array<string, mixed>  $query
     * @return array<string, string>
     */
    public static function lenient(array $query): array
    {
        $rules = self::rules();
        $filters = [];
        foreach (self::PAGE_FILTERS as $key) {
            $value = $query[$key] ?? null;
            if (! is_string($value) || trim($value) === '') {
                continue;
            }
            $value = trim($value);
            if (Validator::make([$key => $value], [$key => $rules[$key]])->passes()) {
                $filters[$key] = $value;
            }
        }

        return $filters;
    }

    /**
     * @param  array<string, mixed>  $filters  validated (validate() or lenient())
     * @return Builder<Document>
     */
    public static function filtered(array $filters, string $today): Builder
    {
        $q = trim((string) ($filters['q'] ?? ''));
        $status = $filters['status'] ?? null;

        return Document::query()
            ->when($filters['type'] ?? null, fn ($query, string $type) => $query->where('type', $type))
            ->when($status === self::OVERDUE, fn ($query) => $query
                ->where('type', DocumentType::Invoice->value)
                ->where('status', DocumentStatus::Open->value)
                ->where('due_date', '<', $today))
            ->when(is_string($status) && $status !== self::OVERDUE, fn ($query) => $query->where('status', $status))
            ->when($filters['customer_id'] ?? null, fn ($query, string $id) => $query->where('customer_id', $id))
            ->when($filters['date_from'] ?? null, fn ($query, string $date) => $query->where('date', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($query, string $date) => $query->where('date', '<=', $date))
            ->when($q !== '', fn ($query) => $query->where(fn ($where) => $where
                ->where('number', 'like', Like::contains($q))
                ->orWhereHas('customer', fn ($customer) => $customer->withTrashed()->where('name', 'like', Like::contains($q)))));
    }

    /**
     * @param  Builder<Document>  $query
     * @return Builder<Document>
     */
    public static function sorted(Builder $query, string $sort = '-date'): Builder
    {
        $direction = str_starts_with($sort, '-') ? 'desc' : 'asc';

        return $query->orderBy(ltrim($sort, '-'), $direction)->orderBy('id', $direction);
    }

    /**
     * Documents per type under the other filters (the type pills of the documents page).
     *
     * @param  array<string, mixed>  $filters
     * @return array{all: int, offer: int, confirmation: int, invoice: int, cancellation: int}
     */
    public static function counts(array $filters, string $today): array
    {
        $byType = self::filtered($filters, $today)->toBase()
            ->selectRaw('type, COUNT(*) as aggregate')
            ->groupBy('type')
            ->pluck('aggregate', 'type');
        $count = fn (DocumentType $type): int => (int) ($byType[$type->value] ?? 0);
        $offer = $count(DocumentType::Offer);
        $confirmation = $count(DocumentType::Confirmation);
        $invoice = $count(DocumentType::Invoice);
        $cancellation = $count(DocumentType::Cancellation);

        return [
            'all' => $offer + $confirmation + $invoice + $cancellation,
            'offer' => $offer,
            'confirmation' => $confirmation,
            'invoice' => $invoice,
            'cancellation' => $cancellation,
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array{count: int, gross_total: string}
     */
    public static function summary(array $filters, string $today): array
    {
        // open/overdue: what is still owed, i.e. invoices after partial cancellations (InvoiceBalance); the filter
        // leaves out the cancellations themselves, so nothing counts twice
        $amount = in_array($filters['status'] ?? null, [DocumentStatus::Open->value, self::OVERDUE], true)
            ? "CASE WHEN documents.type = 'invoice' THEN ".InvoiceBalance::SQL.' ELSE documents.gross_total END'
            : 'documents.gross_total';
        // the query builder returns stdClass rows; as array they are typed for Larastan
        $row = (array) (self::filtered($filters, $today)->toBase()
            ->selectRaw("COUNT(*) as aggregate, SUM({$amount}) as gross")
            ->first() ?? []);

        return ['count' => (int) ($row['aggregate'] ?? 0), 'gross_total' => Amount::of($row['gross'] ?? null)];
    }
}
