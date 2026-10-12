<?php

use App\Actions\FinalizeDocument;
use App\Actions\PruneUnusedImages;
use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Models\FieldDefinition;
use App\Models\Organization;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/** A stored image, `$hours` old (file time). */
function pruneTestImage(string $folder, int $hours = 48): string
{
    $path = $folder.'/'.strtolower((string) Str::ulid()).'.svg';
    Storage::disk('local')->put($path, '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>');
    touch(Storage::disk('local')->path($path), now()->subHours($hours)->getTimestamp());

    return $path;
}

it('deletes only images nothing refers to and keeps those of records, snapshots and fresh uploads (ledger phase 7, review focus)', function () {
    completeOrganization();
    $oldLogo = pruneTestImage('logos');
    Organization::current()->forceFill(['logo_path' => $oldLogo])->save();
    app(FinalizeDocument::class)->handle(systemActor(), draft()); // its snapshot keeps the old logo
    $logo = pruneTestImage('logos');
    Organization::current()->forceFill(['logo_path' => $logo])->save();

    $photo = pruneTestImage('uploads');
    $customer = Customer::factory()->create(['custom' => ['photo' => $photo]]);
    $customer->delete(); // soft-deleted customers still count
    $sketch = pruneTestImage('uploads');
    Document::factory()->create(['custom' => ['sketch' => $sketch]]);
    $fresh = pruneTestImage('uploads', hours: 1); // uploaded, form not saved yet
    $orphan = pruneTestImage('uploads');
    $orphanLogo = pruneTestImage('logos');
    Storage::disk('local')->put('uploads/readme.txt', 'not an upload');

    $prune = app(PruneUnusedImages::class);
    expect($prune->handle(systemActor(), dryRun: true))->toBe(collect([$orphanLogo, $orphan])->sort()->values()->all())
        ->and(Storage::disk('local')->exists($orphan))->toBeTrue();

    expect($prune->handle(systemActor()))->toHaveCount(2);
    foreach ([$oldLogo, $logo, $photo, $sketch, $fresh, 'uploads/readme.txt'] as $kept) {
        expect(Storage::disk('local')->exists($kept))->toBeTrue($kept);
    }
    expect(Storage::disk('local')->exists($orphan))->toBeFalse()
        ->and(Storage::disk('local')->exists($orphanLogo))->toBeFalse()
        ->and($prune->handle(systemActor(), minAgeHours: 0))->toBe([$fresh]);
});

it('keeps an image that only one source still refers to (review phase 11)', function (string $source) {
    $image = pruneTestImage('uploads');
    $orphan = pruneTestImage('uploads');
    match ($source) {
        'soft-deleted contact' => Contact::factory()->create(['custom' => ['badge' => $image]])->delete(),
        'position' => draftDocument(positions: [[...itemRow(), 'custom' => ['photo' => $image]]]),
        'field default' => FieldDefinition::factory()->create(['default_value' => $image]),
        'organization' => Organization::current()->forceFill(['custom' => ['stamp' => $image]])->save(),
    };

    expect(app(PruneUnusedImages::class)->handle(systemActor()))->toBe([$orphan])
        ->and(Storage::disk('local')->exists($image))->toBeTrue();
})->with(['soft-deleted contact', 'position', 'field default', 'organization']);

it('lists with --dry-run, deletes without it and refuses a min-age that is no number', function () {
    $orphan = pruneTestImage('uploads');

    $this->artisan('app:prune-images --dry-run')
        ->expectsOutputToContain("would delete {$orphan}")
        ->expectsOutputToContain('1 unused image(s) found (dry run, nothing deleted).')
        ->assertSuccessful();
    expect(Storage::disk('local')->exists($orphan))->toBeTrue();

    $this->artisan('app:prune-images')->expectsOutputToContain("deleted {$orphan}")->assertSuccessful();
    expect(Storage::disk('local')->exists($orphan))->toBeFalse();

    $this->artisan('app:prune-images --min-age=abc')->assertExitCode(2);
});
