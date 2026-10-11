<?php

namespace App\Actions;

use App\Models\TaxRate;
use App\Support\Actor;

/** Hidden from new positions; existing positions and snapshots keep pointing at it. */
final class ArchiveTaxRate
{
    public function handle(Actor $actor, TaxRate $rate): TaxRate
    {
        $rate->forceFill(['archived_at' => now()])->save();

        return $rate;
    }
}
