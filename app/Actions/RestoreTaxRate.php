<?php

namespace App\Actions;

use App\Models\TaxRate;
use App\Support\Actor;

/** Undo of ArchiveTaxRate: new positions can pick the rate again. */
final class RestoreTaxRate
{
    public function handle(Actor $actor, TaxRate $rate): TaxRate
    {
        $rate->forceFill(['archived_at' => null])->save();

        return $rate;
    }
}
