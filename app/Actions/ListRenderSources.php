<?php

namespace App\Actions;

use App\Enums\RenderScenario;
use App\Models\Document;
use App\Support\Actor;
use App\Support\Like;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/** GET /api/render/sources: what a preview can render – sample scenarios and recent documents (template editor, toolkit). */
final class ListRenderSources
{
    /**
     * @param  array<string, mixed>  $input  q? (number or customer name), limit? (1–100, default 20)
     * @return array{scenarios: list<array{key: string, document_type: string}>, documents: list<array{id: string, type: string, status: string, number: string|null, date: string, customer_name: string|null, locale: string}>}
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, array $input): array
    {
        $data = Validator::make($input, [
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ])->validate();
        $q = trim((string) ($data['q'] ?? ''));

        $documents = Document::query()
            ->with(['customer' => fn ($customer) => $customer->withTrashed()])
            ->when($q !== '', fn ($query) => $query->where(fn ($where) => $where
                ->where('number', 'like', Like::contains($q))
                ->orWhereHas('customer', fn ($customer) => $customer->withTrashed()->where('name', 'like', Like::contains($q)))))
            ->orderByDesc('updated_at')->orderByDesc('id')
            ->limit((int) ($data['limit'] ?? 20))
            ->get();

        return [
            'scenarios' => array_map(fn (RenderScenario $scenario): array => [
                'key' => $scenario->value,
                'document_type' => $scenario->documentType()->value,
            ], RenderScenario::cases()),
            'documents' => $documents->map(fn (Document $document): array => [
                'id' => $document->id,
                'type' => $document->type->value,
                'status' => $document->status->value,
                'number' => $document->number,
                'date' => $document->date->toDateString(),
                'customer_name' => $document->customer?->name,
                'locale' => $document->locale,
            ])->values()->all(),
        ];
    }
}
