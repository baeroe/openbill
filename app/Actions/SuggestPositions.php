<?php

namespace App\Actions;

use App\Enums\DocumentType;
use App\Enums\PositionKind;
use App\Models\Position;
use App\Support\Actor;
use App\Support\Like;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * GET /api/position-suggestions: titles of earlier billable positions (items and optional ones, never
 * from cancellations), most used first, with description, unit, price and tax rate of their latest use.
 * Replaces a product catalogue (prototype: listPositionSuggestions).
 */
final class SuggestPositions
{
    /** Only the most recent positions are scanned. */
    private const SCAN = 2000;

    /**
     * @param  array<string, mixed>  $input  q? (title contains), limit? (1–50, default 20)
     * @return list<array{title: string, description: string, unit_id: string|null, unit_price: string, tax_rate_id: string|null, used_count: int, last_used: string}>
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, array $input): array
    {
        $data = Validator::make($input, [
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ])->validate();
        $q = trim((string) ($data['q'] ?? ''));

        $rows = Position::query()
            ->join('documents', 'documents.id', '=', 'positions.document_id')
            ->whereIn('positions.kind', [PositionKind::Item->value, PositionKind::Optional->value])
            ->where('documents.type', '!=', DocumentType::Cancellation->value)
            ->where('positions.title', '!=', '')
            ->when($q !== '', fn ($query) => $query->where('positions.title', 'like', Like::contains($q)))
            ->orderByDesc('documents.date')
            ->orderByDesc('positions.id')
            ->limit(self::SCAN)
            ->get(['positions.title', 'positions.description', 'positions.unit_id', 'positions.unit_price', 'positions.tax_rate_id', 'documents.date as used_on']);

        $byTitle = [];
        foreach ($rows as $row) {
            $title = trim((string) $row->title);
            $key = mb_strtolower($title);
            // newest first: the first row of a title holds the values of its latest use
            $byTitle[$key] ??= [
                'title' => $title,
                'description' => (string) $row->description,
                'unit_id' => $row->unit_id,
                'unit_price' => (string) $row->unit_price,
                'tax_rate_id' => $row->tax_rate_id,
                'used_count' => 0,
                'last_used' => substr((string) $row->getAttribute('used_on'), 0, 10),
            ];
            $byTitle[$key]['used_count']++;
        }

        $list = array_values($byTitle);
        usort($list, fn (array $a, array $b): int => [$b['used_count'], $b['last_used']] <=> [$a['used_count'], $a['last_used']]);

        return array_slice($list, 0, (int) ($data['limit'] ?? 20));
    }
}
