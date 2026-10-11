<?php

namespace App\Actions;

use App\Models\FieldDefinition;
use App\Support\Actor;

/** Values already stored in custom JSON stay; finalized documents keep the definition in their snapshot. */
final class DeleteFieldDefinition
{
    public function handle(Actor $actor, FieldDefinition $definition): void
    {
        $definition->delete();
    }
}
