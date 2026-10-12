<?php

namespace App\Actions;

use App\Models\Unit;
use App\Support\Actor;

/** Undo of ArchiveUnit. */
final class RestoreUnit
{
    public function handle(Actor $actor, Unit $unit): Unit
    {
        $unit->forceFill(['archived_at' => null])->save();

        return $unit;
    }
}
