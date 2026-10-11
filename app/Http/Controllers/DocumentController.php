<?php

namespace App\Http\Controllers;

use App\Actions\DescribeDocumentPage;
use App\Models\Customer;
use App\Models\Document;
use App\Models\User;
use App\Support\Actor;
use App\Support\DocumentQuery;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Inertia\Inertia;
use Inertia\Response;

class DocumentController extends Controller
{
    /** Filters from the URL; the rows come from GET /api/documents (SWR), counts and sum from here (exact, server-side). */
    public function index(Request $request): Response
    {
        $today = CarbonImmutable::today()->toDateString();
        $filters = DocumentQuery::lenient($request->query());

        return Inertia::render('documents/index', [
            'filters' => [
                'type' => $filters['type'] ?? null,
                'status' => $filters['status'] ?? null,
                'customer_id' => $filters['customer_id'] ?? null,
                'q' => $filters['q'] ?? null,
            ],
            // the type pills show what each type would give under the other filters
            'counts' => DocumentQuery::counts(Arr::except($filters, ['type']), $today),
            'summary' => DocumentQuery::summary($filters, $today),
            'customers' => Customer::query()->orderBy('name')->get(['id', 'name'])
                ->map(fn (Customer $customer): array => ['id' => $customer->id, 'name' => $customer->name])
                ->all(),
        ]);
    }

    /** Document editor: the document itself comes from GET /api/documents/{id} (SWR), the server-side page context from here. */
    public function show(Request $request, string $id, DescribeDocumentPage $describe): Response
    {
        $document = Document::query()->findOrFail($id);
        /** @var User $user */
        $user = $request->user();

        return Inertia::render('documents/show', [
            'document_id' => $document->id,
            'context' => $describe->handle(Actor::user($user), $document),
        ]);
    }
}
