<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\Support\GotenbergFake;

it('keeps the Gotenberg timeout well below the InnoDB lock wait timeout', function () {
    // finalize holds the number_sequences row lock while Gotenberg renders: waiting finalizes must not time out first
    $lockWait = (int) DB::selectOne('SELECT @@innodb_lock_wait_timeout AS t')->t;

    expect(config('services.gotenberg.timeout'))->toBeInt()->toBeGreaterThan(0)
        ->and(config('services.gotenberg.timeout'))->toBeLessThanOrEqual($lockWait - 20);
});

it('has an archive disk below storage/app/archive that throws on errors', function () {
    expect(config('filesystems.disks.archive.root'))->toBe(storage_path('app/archive'))
        ->and(config('filesystems.disks.archive.throw'))->toBeTrue();
});

it('fakes Gotenberg in feature tests and refuses any other HTTP request', function () {
    $pdf = Http::post('http://gotenberg:3000/forms/chromium/convert/html')->body();

    expect($pdf)->toStartWith('%PDF-')
        ->and(fn () => Http::get('https://example.com'))->toThrow(RuntimeException::class);

    GotenbergFake::failWithError();
    expect(Http::post('http://gotenberg:3000/forms/chromium/convert/html')->status())->toBe(500);
});
