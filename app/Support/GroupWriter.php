<?php

namespace App\Support;

use App\Models\Document;
use App\Models\Position;
use App\Models\PositionGroup;

/**
 * Replaces all groups and positions of a draft. Ids that already belong to this document are kept
 * (stable keys for the editor's autosave), all others get new ULIDs. The model hooks refuse finalized documents.
 */
final class GroupWriter
{
    /**
     * @param  list<array<string, mixed>>  $groups
     */
    public static function replace(Document $document, array $groups): void
    {
        Document::assertDraft($document->id);
        $ownGroups = $document->groups()->pluck('id')->all();
        $ownPositions = $document->positions()->pluck('id')->all();

        $document->positions()->delete();
        $document->groups()->delete();

        foreach ($groups as $groupIndex => $row) {
            $group = new PositionGroup;
            $group->forceFill([
                'id' => self::keep($row['id'] ?? null, $ownGroups),
                'document_id' => $document->id,
                'title' => $row['title'] ?? null,
                'sort' => $groupIndex,
            ])->save();

            foreach (array_values($row['positions'] ?? []) as $positionIndex => $p) {
                (new Position)->forceFill([
                    'id' => self::keep($p['id'] ?? null, $ownPositions),
                    'document_id' => $document->id,
                    'group_id' => $group->id,
                    'kind' => $p['kind'],
                    'title' => (string) ($p['title'] ?? ''),
                    'description' => $p['description'] ?? null,
                    'quantity' => (string) ($p['quantity'] ?? '0'),
                    'unit_id' => $p['unit_id'] ?? null,
                    'unit_price' => (string) ($p['unit_price'] ?? '0'),
                    'tax_rate_id' => $p['tax_rate_id'] ?? null,
                    'custom' => $p['custom'] ?? [],
                    'sort' => $positionIndex,
                ])->save();
            }
        }

        $document->unsetRelation('groups')->unsetRelation('positions');
    }

    /**
     * @param  array<int, mixed>  $own
     */
    private static function keep(mixed $id, array $own): ?string
    {
        return is_string($id) && in_array($id, $own, true) ? $id : null;
    }
}
