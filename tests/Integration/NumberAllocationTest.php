<?php

use App\Actions\AllocateDocumentNumber;
use App\Enums\DocumentType;
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
