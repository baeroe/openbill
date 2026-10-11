<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Document;
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

    /** Summary page of a document; phase 6 replaces it with the editor (same route and prop). */
    public function show(string $id): Response
    {
        return Inertia::render('documents/show', ['document_id' => Document::query()->findOrFail($id)->id]);
    }
}
