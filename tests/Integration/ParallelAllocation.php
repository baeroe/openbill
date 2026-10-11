<?php

namespace Tests\Integration;

use App\Actions\AllocateDocumentNumber;
use App\Enums\DocumentType;
use Closure;
use Illuminate\Support\Facades\DB;

/**
 * Work for the child processes of NumberAllocationTest. The closure is serialized together with its
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
}
