<?php

namespace App\State\Provider;

use ApiPlatform\Laravel\Eloquent\Paginator;
use ApiPlatform\Metadata\CollectionOperationInterface;
use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\ApiResource\DocumentResource;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Document;
use App\State\ApiContext;
use App\State\Paginate;
use App\Support\DocumentInspector;
use App\Support\Like;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/** @implements ProviderInterface<DocumentResource> */
final class DocumentProvider implements ProviderInterface
{
    private const SORTS = ['date', 'number', 'updated_at', 'gross_total'];

    public function __construct(private readonly DocumentInspector $inspector) {}

    /**
     * @return DocumentResource|Paginator<DocumentResource>
     */
    public function provide(Operation $operation, array $uriVariables = [], array $context = []): object
    {
        if (! $operation instanceof CollectionOperationInterface) {
            return DocumentResource::fromModel(self::load((string) $uriVariables['id']), $this->inspector);
        }

        $request = ApiContext::request($context);
        $filters = Validator::make($request->query(), [
            'type' => ['sometimes', Rule::enum(DocumentType::class)],
            'status' => ['sometimes', Rule::enum(DocumentStatus::class)],
            'customer_id' => ['sometimes', 'string', 'max:26'],
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
            'date_from' => ['sometimes', 'date_format:Y-m-d'],
            'date_to' => ['sometimes', 'date_format:Y-m-d'],
            'sort' => ['sometimes', Rule::in([...self::SORTS, ...array_map(fn (string $s): string => "-{$s}", self::SORTS)])],
        ])->validate();

        $q = trim((string) ($filters['q'] ?? ''));
        $sort = $filters['sort'] ?? '-date';
        $direction = str_starts_with($sort, '-') ? 'desc' : 'asc';

        $query = Document::query()
            ->with(['customer' => fn ($customer) => $customer->withTrashed()])
            ->when($filters['type'] ?? null, fn ($query, string $type) => $query->where('type', $type))
            ->when($filters['status'] ?? null, fn ($query, string $status) => $query->where('status', $status))
            ->when($filters['customer_id'] ?? null, fn ($query, string $id) => $query->where('customer_id', $id))
            ->when($filters['date_from'] ?? null, fn ($query, string $date) => $query->where('date', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($query, string $date) => $query->where('date', '<=', $date))
            ->when($q !== '', fn ($query) => $query->where(fn ($where) => $where
                ->where('number', 'like', Like::contains($q))
                ->orWhereHas('customer', fn ($customer) => $customer->withTrashed()->where('name', 'like', Like::contains($q)))))
            ->orderBy(ltrim($sort, '-'), $direction)
            ->orderBy('id', $direction);

        return Paginate::query($query, $request, fn (Document $document): DocumentResource => DocumentResource::fromModel($document));
    }

    /** Everything the item form needs; finalized documents read totals from their snapshot. */
    public static function load(string $id): Document
    {
        return Document::query()
            ->with(['groups.positions', 'snapshot', 'customer' => fn ($customer) => $customer->withTrashed()])
            ->findOrFail($id);
    }
}
