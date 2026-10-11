<?php

namespace App\Actions;

use App\Models\TextBlock;
use App\Support\Actor;

/** Document type defaults pointing at it become NULL (foreign key ON DELETE SET NULL). */
final class DeleteTextBlock
{
    public function handle(Actor $actor, TextBlock $block): void
    {
        $block->delete();
    }
}
