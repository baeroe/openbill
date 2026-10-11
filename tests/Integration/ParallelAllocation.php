<?php

namespace Tests\Integration;

use App\Actions\AllocateDocumentNumber;
use App\Actions\FinalizeDocument;
use App\Enums\DocumentType;
use App\Exceptions\DocumentLockedException;
use App\Models\Document;
use App\Support\Actor;
use Closure;
use Illuminate\Support\Facades\DB;

/**
 * Work for the child processes of the Integration tests. The closure is serialized together with its
 * scope class; a closure defined in a Pest file would carry Pest's generated test class, which the
 * child process (`php artisan invoke-serialized-closure`) cannot load. This class is autoloaded.
 */
final class ParallelAllocation
{
    /** @return Closure(): array{database: string, numbers: list<string>} */
    public static function task(int $count = 5): Closure
    {
        return static function () use ($count): array {
            $numbers = [];
            for ($i = 0; $i < $count; $i++) {
                $numbers[] = DB::transaction(
                    fn () => app(AllocateDocumentNumber::class)->handle(DocumentType::Invoice, '2026-10-11'),
                );
            }

            return ['database' => DB::connection()->getDatabaseName(), 'numbers' => $numbers];
        };
    }

    /**
     * Tries to finalize every draft in $ids; returns per id the number, or "locked" when another
     * process finalized it first.
     *
     * @param  list<string>  $ids
     * @return Closure(): array<string, string>
     */
    public static function finalizeTask(array $ids): Closure
    {
        return static function () use ($ids): array {
            $results = [];
            foreach ($ids as $id) {
                try {
                    $document = app(FinalizeDocument::class)->handle(Actor::system(), Document::query()->findOrFail($id));
                    $results[$id] = (string) $document->number;
                } catch (DocumentLockedException) {
                    $results[$id] = 'locked';
                }
            }

            return $results;
        };
    }
}
