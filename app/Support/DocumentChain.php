<?php

namespace App\Support;

use App\Models\Document;

/**
 * The chain of a document along source_id (offer → confirmation → invoice → cancellation): the root and all its
 * successors, breadth first in creation order. Duplicates have no source and are never part of a chain.
 */
final class DocumentChain
{
    /** Guards against corrupt data (a source cycle); real chains have at most four members per branch. */
    private const MAX = 50;

    /**
     * @return list<array{id: string, type: string, status: string, number: string|null}> empty when the document stands alone
     */
    public static function for(Document $document): array
    {
        $root = $document;
        $seen = [$root->id => true];
        while ($root->source_id !== null && ! isset($seen[$root->source_id]) && count($seen) < self::MAX) {
            $parent = Document::query()->find($root->source_id);
            if ($parent === null) {
                break;
            }
            $seen[$parent->id] = true;
            $root = $parent;
        }

        $chain = [];
        $visited = [];
        $queue = [$root];
        while ($queue !== [] && count($chain) < self::MAX) {
            $current = array_shift($queue);
            if (isset($visited[$current->id])) {
                continue;
            }
            $visited[$current->id] = true;
            $chain[] = $current;
            $children = Document::query()->where('source_id', $current->id)->orderBy('created_at')->orderBy('id')->get();
            foreach ($children as $child) {
                $queue[] = $child;
            }
        }

        if (count($chain) < 2) {
            return [];
        }

        return array_map(fn (Document $member): array => [
            'id' => $member->id,
            'type' => $member->type->value,
            'status' => $member->status->value,
            'number' => $member->number,
        ], $chain);
    }
}
