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
