<?php

namespace App\Console\Commands;

use App\Actions\PruneUnusedImages;
use App\Support\Actor;
use Illuminate\Console\Command;

class PruneImages extends Command
{
    protected $signature = 'app:prune-images
        {--dry-run : Only list the files that would be deleted}
        {--min-age=24 : Keep files younger than this many hours (uploads are stored before their form is saved)}';

    protected $description = 'Delete uploaded images and old logos that no record and no finalized document refers to';

    public function handle(PruneUnusedImages $prune): int
    {
        $minAge = $this->option('min-age');
        if (! is_string($minAge) || ! ctype_digit($minAge)) {
            $this->error('--min-age must be a whole number of hours.');

            return self::INVALID;
        }
        $dryRun = (bool) $this->option('dry-run');

        $paths = $prune->handle(Actor::system(), $dryRun, (int) $minAge);
        foreach ($paths as $path) {
            $this->line(($dryRun ? 'would delete ' : 'deleted ').$path);
        }
        $this->info(sprintf('%d unused image(s) %s.', count($paths), $dryRun ? 'found (dry run, nothing deleted)' : 'deleted'));

        return self::SUCCESS;
    }
}
