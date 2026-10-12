<?php

use App\Models\TaxRate;
use App\Models\Unit;

beforeEach(fn () => $this->withToken(apiToken()));

it('restores an archived tax rate so new positions can pick it again', function () {
    $rate = TaxRate::query()->firstOrFail();

    $this->deleteJson("/api/tax-rates/{$rate->id}")->assertNoContent();
    expect(collect($this->getJson('/api/tax-rates')->json())->pluck('id'))->not->toContain($rate->id);

    $this->postJson("/api/tax-rates/{$rate->id}/restore")->assertOk()->assertJsonPath('archived_at', null);
    expect(collect($this->getJson('/api/tax-rates')->json())->pluck('id'))->toContain($rate->id);
});

it('restores an archived unit', function () {
    $unit = Unit::query()->firstOrFail();
    $this->deleteJson("/api/units/{$unit->id}")->assertNoContent();

    $this->postJson("/api/units/{$unit->id}/restore")->assertOk()->assertJsonPath('id', $unit->id)->assertJsonPath('archived_at', null);
    expect($unit->fresh()->archived_at)->toBeNull();
});

it('refuses category O as a tax rate of its own (review #3)', function () {
    $rate = TaxRate::query()->firstOrFail();

    $this->postJson('/api/tax-rates', ['label' => 'O 19', 'percent' => '19', 'category' => 'O'])
        ->assertUnprocessable()
        ->assertJsonPath('violations.0.path', 'category');
    $this->patchJson("/api/tax-rates/{$rate->id}", ['category' => 'O'], ['Content-Type' => 'application/merge-patch+json'])
        ->assertUnprocessable()
        ->assertJsonPath('violations.0.path', 'category');
});
