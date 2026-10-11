<?php

namespace App\Actions;

use App\Models\Template;
use App\Support\Actor;

final class SyncBuiltInTemplates
{
    public const SLUGS = ['klar', 'kante', 'leise'];

    /** @return array<string, Template> */
    public function handle(Actor $actor): array
    {
        return []; // task 8
    }
}
