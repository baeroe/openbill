<?php

use App\Actions\AllocateDocumentNumber;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Models\Document;
use App\Models\DocumentEvent;
use App\Models\DocumentSnapshot;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Concurrency;
use Illuminate\Support\Facades\DB;
use Tests\Integration\ParallelAllocation;

it('never hands out the same number to parallel processes', function () {
    // the closure lives in an autoloaded class, see ParallelAllocation
    $task = ParallelAllocation::task();

    $results = Concurrency::driver('process')->run(array_fill(0, 6, $task));

    $numbers = array_merge(...array_column($results, 'numbers'));
    sort($numbers);

    expect(array_unique(array_column($results, 'database')))->toBe(['testing'])
        ->and($numbers)->toBe(array_map(fn (int $n): string => sprintf('INV-2026-%04d', $n), range(1, 30)));
});

it('finalizes drafts in parallel processes exactly once with unique numbers', function () {
    $ids = array_map(fn (): string => draft()->id, range(1, 12));

    // four processes race for every draft, each in a different order
    $tasks = array_map(fn (int $shift): Closure => ParallelAllocation::finalizeTask([
        ...array_slice($ids, $shift * 3), ...array_slice($ids, 0, $shift * 3),
    ]), range(0, 3));
    $results = Concurrency::driver('process')->run($tasks);

    $numbers = array_values(array_filter(array_merge(...array_map('array_values', $results)), fn (string $r): bool => $r !== 'locked'));
    sort($numbers);
    $year = now()->format('Y');

    expect($numbers)->toBe(array_map(fn (int $n): string => sprintf("INV-{$year}-%04d", $n), range(1, 12)))
        ->and(Document::query()->whereIn('id', $ids)->where('status', DocumentStatus::Open)->whereNotNull('finalized_at')->count())->toBe(12)
        ->and(DocumentSnapshot::query()->whereIn('document_id', $ids)->count())->toBe(12)
        ->and(DocumentEvent::query()->whereIn('document_id', $ids)->where('action', EventAction::Finalized)->count())->toBe(12);
});

it('makes a second connection wait while the first one holds the number range', function () {
    $name = config('database.default');
    config(["database.connections.{$name}_second" => config("database.connections.{$name}")]);
    $second = DB::connection("{$name}_second");
    $second->statement('SET SESSION innodb_lock_wait_timeout = 1');
    $lockRow = fn () => $second->table('number_sequences')->where('doc_type', 'invoice')->whereNull('year')->lockForUpdate()->first();

    DB::beginTransaction();
    $first = app(AllocateDocumentNumber::class)->handle(DocumentType::Invoice, '2026-10-11');

    $second->beginTransaction();
    expect($lockRow)->toThrow(QueryException::class, 'Lock wait timeout');
    $second->rollBack();

    DB::commit();

    $second->beginTransaction();
    expect($lockRow())->not->toBeNull();
    $second->rollBack();

    expect($first)->toBe('INV-2026-0001')
        ->and(DB::transaction(fn () => app(AllocateDocumentNumber::class)->handle(DocumentType::Invoice, '2026-10-11')))->toBe('INV-2026-0002');
});

// Feature tests always run inside the RefreshDatabase transaction, so the guard is only testable here
it('refuses to allocate outside a transaction', function () {
    app(AllocateDocumentNumber::class)->handle(DocumentType::Invoice, '2026-10-11');
})->throws(LogicException::class);
