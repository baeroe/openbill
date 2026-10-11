<?php

namespace App\Console\Commands;

use App\Actions\SyncBuiltInTemplates;
use App\Support\Actor;
use Illuminate\Console\Command;

class SyncTemplates extends Command
{
    protected $signature = 'app:sync-templates';

    protected $description = 'Create or update the built-in templates (Klar, Kante, Leise)';

    public function handle(SyncBuiltInTemplates $sync): int
    {
        $templates = $sync->handle(Actor::system());
        $this->info('Built-in templates: '.implode(', ', array_keys($templates)));

        return self::SUCCESS;
    }
}
