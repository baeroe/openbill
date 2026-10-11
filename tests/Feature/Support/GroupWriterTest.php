<?php

use App\Enums\DocumentType;
use App\Support\GroupWriter;

it('writes groups and positions in order', function () {
    $document = draftDocument(DocumentType::Offer);

    GroupWriter::replace($document, [
        ['title' => 'Konzept', 'positions' => [itemRow('Workshop'), itemRow('Wireframes')]],
        ['title' => null, 'positions' => [itemRow('Hosting', '12', '49', ['kind' => 'optional'])]],
    ]);
    $document->load('groups.positions');

    expect($document->groups->pluck('title')->all())->toBe(['Konzept', null])
        ->and($document->groups[0]->positions->pluck('title')->all())->toBe(['Workshop', 'Wireframes'])
        ->and($document->groups[1]->positions[0]->quantity)->toBe('12.0000')
        ->and($document->positions()->count())->toBe(3);
});

it('keeps ids of its own groups and positions and replaces foreign ones', function () {
    $document = draftDocument(DocumentType::Invoice, [itemRow('A')]);
    $other = draftDocument(DocumentType::Invoice, [itemRow('B')]);
    $groupId = $document->groups[0]->id;
    $positionId = $document->groups[0]->positions[0]->id;
    $foreignId = $other->groups[0]->positions[0]->id;

    GroupWriter::replace($document, [['id' => $groupId, 'title' => null, 'positions' => [
        [...itemRow('A2'), 'id' => $positionId],
        [...itemRow('C'), 'id' => $foreignId],
    ]]]);
    $document->load('groups.positions');

    expect($document->groups[0]->id)->toBe($groupId)
        ->and($document->groups[0]->positions[0]->id)->toBe($positionId)
        ->and($document->groups[0]->positions[0]->title)->toBe('A2')
        ->and($document->groups[0]->positions[1]->id)->not->toBe($foreignId)
        ->and($other->positions()->whereKey($foreignId)->exists())->toBeTrue();
});
