<?php

use App\Actions\ReorderFieldDefinitions;
use App\Enums\FieldScope;
use App\Models\FieldDefinition;

it('stores the order of one level and leaves the others alone', function () {
    [$a, $b, $c] = FieldDefinition::factory()->count(3)->sequence(['sort' => 0], ['sort' => 1], ['sort' => 2])->create();
    $org = FieldDefinition::factory()->create(['scope' => FieldScope::Org, 'doc_types' => [], 'sort' => 5]);

    app(ReorderFieldDefinitions::class)->handle(systemActor(), ['scope' => 'document', 'ids' => [$c->id, $a->id, $b->id]]);

    expect(FieldDefinition::query()->where('scope', 'document')->orderBy('sort')->pluck('id')->all())->toBe([$c->id, $a->id, $b->id])
        ->and($org->fresh()->sort)->toBe(5);
});

it('refuses missing, foreign or repeated ids and changes nothing (review focus)', function (Closure $ids) {
    [$a, $b] = FieldDefinition::factory()->count(2)->sequence(['sort' => 0], ['sort' => 1])->create();
    $org = FieldDefinition::factory()->create(['scope' => FieldScope::Org, 'doc_types' => []]);

    $errors = validationErrors(fn () => app(ReorderFieldDefinitions::class)->handle(systemActor(), ['scope' => 'document', 'ids' => $ids($a, $b, $org)]));

    expect(array_keys($errors)[0])->toStartWith('ids')
        ->and(FieldDefinition::query()->where('scope', 'document')->orderBy('sort')->pluck('id')->all())->toBe([$a->id, $b->id]);
})->with([
    'one missing' => [fn ($a, $b, $org) => [$b->id]],
    'foreign level' => [fn ($a, $b, $org) => [$b->id, $a->id, $org->id]],
    'twice' => [fn ($a, $b, $org) => [$b->id, $b->id]],
]);

it('reorders over the API', function () {
    [$a, $b] = FieldDefinition::factory()->count(2)->sequence(['sort' => 0], ['sort' => 1])->create();

    $this->withToken(apiToken())->postJson('/api/field-definitions/reorder', ['scope' => 'document', 'ids' => [$b->id, $a->id]])->assertNoContent();

    expect($a->fresh()->sort)->toBe(1);
});
