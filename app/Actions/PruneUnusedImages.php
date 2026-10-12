<?php

namespace App\Actions;

use App\Support\Actor;
use App\Support\ImageReferences;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Storage;

/**
 * php artisan app:prune-images: deletes uploaded images (uploads/) and old logos (logos/) that no record and no
 * snapshot refers to anymore (ImageReferences). Files younger than $minAgeHours stay: an upload is stored before the
 * form that uses it is saved. Other files in those folders are never touched.
 */
final class PruneUnusedImages
{
    public const FOLDERS = ['uploads', 'logos'];

    /**
     * @return list<string> the deleted paths (with $dryRun: the paths that would be deleted), sorted
     */
    public function handle(Actor $actor, bool $dryRun = false, int $minAgeHours = 24): array
    {
        $disk = Storage::disk('local');
        $used = ImageReferences::all();
        $cutoff = CarbonImmutable::now()->subHours(max(0, $minAgeHours))->getTimestamp();

        $unused = [];
        foreach (self::FOLDERS as $folder) {
            foreach ($disk->files($folder) as $path) {
                if (! ImageReferences::isImagePath($path) || isset($used[$path]) || $disk->lastModified($path) > $cutoff) {
                    continue;
                }
                $unused[] = $path;
            }
        }
        sort($unused);
        if (! $dryRun && $unused !== []) {
            $disk->delete($unused);
        }

        return $unused;
    }
}
