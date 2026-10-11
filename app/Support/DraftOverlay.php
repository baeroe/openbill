<?php

namespace App\Support;

use App\Models\Document;
use App\Models\Position;
use App\Models\PositionGroup;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Arr;

/**
 * The unsaved state of a draft for previews (editor autosave still pending): the stored draft with
 * validated DraftInput data on top. The result is an in-memory copy and must never be saved.
 */
final class DraftOverlay
{
    /**
     * @param  array<string, mixed>  $data  result of DraftInput::validate()
     */
    public static function apply(Document $draft, array $data): Document
    {
        $draft->loadMissing('groups.positions');
        $virtual = clone $draft;
        $virtual->fill(Arr::only($data, DraftInput::FIELDS));
        if (! array_key_exists('groups', $data)) {
            return $virtual;
        }

        $groups = [];
        foreach (array_values($data['groups']) as $g => $row) {
            $group = new PositionGroup(['title' => $row['title'] ?? null, 'sort' => $g]);
            $group->id = is_string($row['id'] ?? null) ? $row['id'] : "draft-group-{$g}";
            $positions = [];
            foreach (array_values($row['positions'] ?? []) as $p => $item) {
                $position = new Position([
                    'kind' => $item['kind'],
                    'title' => $item['title'] ?? '',
                    'description' => $item['description'] ?? '',
                    'quantity' => (string) ($item['quantity'] ?? '0'),
                    'unit_price' => (string) ($item['unit_price'] ?? '0'),
                    'unit_id' => $item['unit_id'] ?? null,
                    'tax_rate_id' => $item['tax_rate_id'] ?? null,
                    'custom' => $item['custom'] ?? [],
                    'sort' => $p,
                ]);
                $position->id = is_string($item['id'] ?? null) ? $item['id'] : "draft-position-{$g}-{$p}";
                $positions[] = $position;
            }
            $group->setRelation('positions', new Collection($positions));
            $groups[] = $group;
        }
        $virtual->setRelation('groups', new Collection($groups));

        return $virtual;
    }
}
