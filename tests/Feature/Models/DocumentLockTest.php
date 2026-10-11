<?php

use App\Enums\DocumentStatus;
use App\Exceptions\DocumentLockedException;
use App\Models\Document;
use App\Models\DocumentFile;
use App\Models\DocumentSnapshot;
use App\Models\Position;
use App\Models\PositionGroup;
use App\Support\DocumentInspector;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** A document with one group and one position, then finalized directly on the model. */
function lockedDocument(): Document
{
    $document = Document::factory()->create();
    $group = new PositionGroup;
    $group->forceFill(['document_id' => $document->id, 'title' => null, 'sort' => 0])->save();
    $position = new Position;
    $position->forceFill([
        'document_id' => $document->id, 'group_id' => $group->id, 'kind' => 'item', 'title' => 'Consulting',
        'quantity' => '1', 'unit_price' => '100', 'custom' => [], 'sort' => 0,
    ])->save();
    $document->forceFill(['number' => 'INV-1', 'status' => DocumentStatus::Open, 'finalized_at' => now()])->save();

    return $document->fresh();
}

it('lets a draft change freely', function () {
    $document = Document::factory()->create();
    $document->intro = 'Hello';
    $document->save();

    expect($document->fresh()->intro)->toBe('Hello');
});

it('still allows status, paid_at and cancelled_by_id on a finalized document', function () {
    $document = lockedDocument();
    $document->forceFill(['status' => DocumentStatus::Paid, 'paid_at' => now()])->save();

    expect($document->fresh()->status)->toBe(DocumentStatus::Paid);
});

it('refuses every other change on a finalized document', function () {
    $document = lockedDocument();
    $document->intro = 'changed';

    expect(fn () => $document->save())->toThrow(DocumentLockedException::class)
        ->and($document->fresh()->intro)->not->toBe('changed');
});

it('names the locked fields', function () {
    $document = lockedDocument();
    $document->forceFill(['number' => 'INV-2', 'status' => DocumentStatus::Paid]);

    try {
        $document->save();
        $this->fail('no exception');
    } catch (DocumentLockedException $e) {
        expect($e->fields)->toBe(['number'])
            ->and($e->status())->toBe(409)
            ->and($e->getMessage())->toBe('INV-1 is finalized and can no longer be changed.');
    }
});

it('refuses to delete a finalized document', function () {
    expect(fn () => lockedDocument()->delete())->toThrow(DocumentLockedException::class);
});

it('refuses to change, add or delete positions and groups of a finalized document', function () {
    $document = lockedDocument();
    $position = $document->positions()->firstOrFail();
    $group = $document->groups()->firstOrFail();

    $position->title = 'changed';
    expect(fn () => $position->save())->toThrow(DocumentLockedException::class)
        ->and(fn () => $position->delete())->toThrow(DocumentLockedException::class)
        ->and(fn () => $group->delete())->toThrow(DocumentLockedException::class)
        ->and(fn () => (new PositionGroup)->forceFill(['document_id' => $document->id, 'sort' => 1])->save())->toThrow(DocumentLockedException::class);
});

it('never changes a snapshot once written', function () {
    $snapshot = DocumentSnapshot::query()->create(['document_id' => lockedDocument()->id, 'data' => ['org' => ['name' => 'A']]]);
    $snapshot->data = ['org' => ['name' => 'B']];

    expect(fn () => $snapshot->save())->toThrow(LogicException::class);
});

it('never sets a finalized document back to draft or unfinalizes it', function (array $change, string $field) {
    $document = lockedDocument();
    $document->forceFill($change);

    try {
        $document->save();
        $this->fail('no exception');
    } catch (DocumentLockedException $e) {
        expect($e->fields)->toBe([$field]);
    }
})->with([
    'status draft' => [['status' => DocumentStatus::Draft], 'status'],
    'finalized_at null' => [['finalized_at' => null], 'finalized_at'],
]);

it('refuses to move positions and groups out of a finalized document', function () {
    $document = lockedDocument();
    $draft = Document::factory()->create();
    $draftGroup = (new PositionGroup)->forceFill(['document_id' => $draft->id, 'sort' => 0]);
    $draftGroup->save();

    $position = $document->positions()->firstOrFail();
    $position->forceFill(['document_id' => $draft->id, 'group_id' => $draftGroup->id]);
    $group = $document->groups()->firstOrFail();
    $group->document_id = $draft->id;

    expect(fn () => $position->save())->toThrow(DocumentLockedException::class)
        ->and(fn () => $group->save())->toThrow(DocumentLockedException::class)
        ->and($document->fresh()->positions()->count())->toBe(1)
        ->and($document->fresh()->groups()->count())->toBe(1);
});

it('refuses to put a draft position into a group of another document', function () {
    $document = lockedDocument();
    $draft = Document::factory()->create();
    $draftGroup = (new PositionGroup)->forceFill(['document_id' => $draft->id, 'sort' => 0]);
    $draftGroup->save();
    $position = (new Position)->forceFill([
        'document_id' => $draft->id, 'group_id' => $draftGroup->id, 'kind' => 'item', 'title' => 'Draft line',
        'quantity' => '1', 'unit_price' => '1', 'custom' => [], 'sort' => 0,
    ]);
    $position->save();

    $position->group_id = $document->groups()->firstOrFail()->id;

    expect(fn () => $position->save())->toThrow(LogicException::class)
        ->and($document->fresh()->groups[0]->positions()->count())->toBe(1);
});

it('locks finalized documents on the database level against query-builder writes', function () {
    $document = lockedDocument();
    $position = $document->positions()->firstOrFail();
    $group = $document->groups()->firstOrFail();
    $draft = Document::factory()->create();
    $draftGroup = (new PositionGroup)->forceFill(['document_id' => $draft->id, 'sort' => 0]);
    $draftGroup->save();

    $writes = [
        'document column' => fn () => Document::query()->whereKey($document->id)->update(['intro' => 'changed']),
        'document back to draft' => fn () => Document::query()->whereKey($document->id)->update(['status' => 'draft']),
        'document delete' => fn () => DB::table('documents')->where('id', $document->id)->delete(),
        'position update' => fn () => Position::query()->whereKey($position->id)->update(['title' => 'changed']),
        'position delete' => fn () => $document->positions()->delete(),
        'position moved out' => fn () => Position::query()->whereKey($position->id)->update(['document_id' => $draft->id, 'group_id' => $draftGroup->id]),
        'group update' => fn () => PositionGroup::query()->whereKey($group->id)->update(['title' => 'changed']),
        'group delete' => fn () => $document->groups()->delete(),
        'group insert' => fn () => DB::table('position_groups')->insert(['id' => strtolower((string) Str::ulid()), 'document_id' => $document->id, 'sort' => 1]),
        'position into foreign group' => fn () => DB::table('positions')->insert([
            'id' => strtolower((string) Str::ulid()), 'document_id' => $draft->id, 'group_id' => $group->id, 'kind' => 'item', 'sort' => 0,
        ]),
    ];

    foreach ($writes as $name => $write) {
        try {
            $write();
            $this->fail("{$name}: no exception");
        } catch (QueryException $e) {
            expect($e->getMessage())->toContain('openbill:');
        }
    }

    expect(Document::query()->whereKey($document->id)->update(['status' => 'paid', 'paid_at' => now()]))->toBe(1)
        ->and($document->fresh()->intro)->not->toBe('changed')
        ->and($document->fresh()->positions()->count())->toBe(1);
});

it('never changes or deletes snapshots and files, also not through the query builder', function () {
    $document = lockedDocument();
    $snapshot = DocumentSnapshot::query()->create(['document_id' => $document->id, 'data' => ['org' => ['name' => 'A']]]);
    $file = DocumentFile::query()->create(['document_id' => $document->id, 'kind' => 'pdf', 'path' => 'documents/a.pdf', 'sha256' => str_repeat('a', 64), 'size' => 1]);

    expect(fn () => $snapshot->delete())->toThrow(LogicException::class)
        ->and(fn () => $file->delete())->toThrow(LogicException::class)
        ->and(fn () => DB::table('document_snapshots')->where('id', $snapshot->id)->update(['data' => '{}']))->toThrow(QueryException::class)
        ->and(fn () => DB::table('document_snapshots')->where('id', $snapshot->id)->delete())->toThrow(QueryException::class)
        ->and(fn () => DB::table('document_files')->where('id', $file->id)->update(['path' => 'x']))->toThrow(QueryException::class)
        ->and(fn () => DB::table('document_files')->where('id', $file->id)->delete())->toThrow(QueryException::class)
        ->and($snapshot->fresh()->data)->toBe(['org' => ['name' => 'A']]);
});

it('never computes a finalized document from live master data', function () {
    expect(fn () => app(DocumentInspector::class)->sources(lockedDocument()))->toThrow(LogicException::class);
});
