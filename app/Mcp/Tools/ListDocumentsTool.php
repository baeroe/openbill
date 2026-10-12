<?php

namespace App\Mcp\Tools;

use App\ApiResource\DocumentResource;
use App\Mcp\Output;
use App\Mcp\Schemas;
use App\Models\Document;
use App\Support\Actor;
use App\Support\DocumentQuery;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list-documents')]
#[Description('Documents in short form (number, type, status, customer, dates, totals; no texts or positions), newest date first. Filters: type, status (overdue = open invoices past their due date), customer_id, q (number or customer name), date_from/date_to, sort. Paged with page and per_page. get-document returns one document completely.')]
#[IsReadOnly]
final class ListDocumentsTool extends OpenbillTool
{
    private const FILTERS = ['type', 'status', 'customer_id', 'q', 'date_from', 'date_to', 'sort'];

    protected function run(Request $request, Actor $actor): Response
    {
        [$page, $perPage] = self::paging($request);
        $filters = DocumentQuery::validate($request->all(self::FILTERS));
        $documents = DocumentQuery::sorted(DocumentQuery::filtered($filters, now()->toDateString()), (string) ($filters['sort'] ?? '-date'))
            ->with(['customer' => fn ($customer) => $customer->withTrashed()])
            ->paginate(perPage: $perPage, page: $page);

        return Output::json(Output::page(
            $documents,
            fn (Document $document): array => Output::resource(DocumentResource::fromModel($document), DocumentResource::LIST),
        ));
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'type' => $schema->string()->enum(['offer', 'confirmation', 'invoice', 'cancellation']),
            'status' => $schema->string()->enum(['draft', 'open', 'accepted', 'rejected', 'done', 'paid', 'cancelled', 'closed', 'overdue']),
            'customer_id' => $schema->string()->description('Customer ID (ULID)'),
            'q' => $schema->string()->description('Number or customer name contains'),
            'date_from' => $schema->string()->description('Document date from (YYYY-MM-DD)'),
            'date_to' => $schema->string()->description('Document date until (YYYY-MM-DD)'),
            'sort' => $schema->string()->enum(['date', '-date', 'number', '-number', 'updated_at', '-updated_at', 'gross_total', '-gross_total'])
                ->description('"-" sorts descending; default -date'),
            ...Schemas::paging($schema),
        ];
    }
}
