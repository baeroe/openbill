<?php

use App\Enums\DocumentStatus;
use App\Exceptions\DocumentLockedException;
use App\Models\Document;
use App\Models\DocumentSnapshot;
use App\Models\Position;
use App\Models\PositionGroup;

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
