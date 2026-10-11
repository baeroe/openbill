<?php

namespace App\Actions;

use App\Models\Unit;
use App\Support\Actor;

final class ArchiveUnit
{
    public function handle(Actor $actor, Unit $unit): Unit
    {
        $unit->forceFill(['archived_at' => now()])->save();

        return $unit;
    }
}
