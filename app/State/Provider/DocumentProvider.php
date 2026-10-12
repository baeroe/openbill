<?php

namespace App\State\Provider;

use ApiPlatform\Laravel\Eloquent\Paginator;
use ApiPlatform\Metadata\CollectionOperationInterface;
use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\ApiResource\DocumentResource;
use App\Models\Document;
use App\State\ApiContext;
use App\State\Paginate;
use App\Support\DocumentInspector;
use App\Support\DocumentQuery;
use App\Support\InvoiceBalance;

/** @implements ProviderInterface<DocumentResource> */
final class DocumentProvider implements ProviderInterface
{
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
        $filters = DocumentQuery::validate($request->query());
        $query = InvoiceBalance::withCancelled(DocumentQuery::sorted(DocumentQuery::filtered($filters, now()->toDateString()), (string) ($filters['sort'] ?? '-date')))
            ->with(['customer' => fn ($customer) => $customer->withTrashed()]);

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
