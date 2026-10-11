<?php

use App\Models\TaxRate;
use App\Models\Unit;

beforeEach(fn () => $this->withToken(apiToken()));

it('lists the active tax rates with percent as string', function () {
    $this->getJson('/api/tax-rates')
        ->assertOk()
        ->assertJsonCount(3)
        ->assertJsonPath('0.percent', '19.00')
        ->assertJsonPath('0.category', 'S')
        ->assertJsonPath('0.archived_at', null);
});

it('creates, changes and archives a tax rate', function () {
    $id = $this->postJson('/api/tax-rates', ['label' => '5 %', 'percent' => '5.00', 'category' => 'S'])
        ->assertCreated()
        ->assertJsonPath('percent', '5.00')
        ->json('id');

    $this->patchJson("/api/tax-rates/{$id}", ['label' => '5 % reduced'])
        ->assertOk()
        ->assertJsonPath('label', '5 % reduced')
        ->assertJsonPath('percent', '5.00');

    $this->deleteJson("/api/tax-rates/{$id}")->assertNoContent();

    expect(TaxRate::query()->findOrFail($id)->archived_at)->not->toBeNull();
    $this->getJson('/api/tax-rates')->assertJsonCount(3);
    $this->getJson('/api/tax-rates?include_archived=1')->assertJsonCount(4);
});

it('refuses a percent sent as JSON number with its field path', function () {
    $this->postJson('/api/tax-rates', ['label' => 'Odd', 'percent' => 5.5, 'category' => 'S'])
        ->assertUnprocessable()
        ->assertJsonPath('reason', 'validation_failed')
        ->assertJsonPath('violations.0.path', 'percent');

    expect(TaxRate::query()->count())->toBe(3);
});

it('creates and archives units and validates the UN/ECE code', function () {
    $id = $this->postJson('/api/units', ['name' => 'Lump sum', 'symbol' => 'ls', 'decimals' => 0, 'code' => 'LS'])
        ->assertCreated()
        ->assertJsonPath('code', 'LS')
        ->json('id');

    $this->postJson('/api/units', ['name' => 'Broken', 'code' => 'xx'])
        ->assertUnprocessable()
        ->assertJsonPath('violations.0.path', 'code');

    $this->deleteJson("/api/units/{$id}")->assertNoContent();
    expect(Unit::query()->findOrFail($id)->archived_at)->not->toBeNull();
});

it('answers an unknown id with 404 problem details', function () {
    $this->getJson('/api/units/01JAAAAAAAAAAAAAAAAAAAAAAA')
        ->assertNotFound()
        ->assertHeader('Content-Type', 'application/problem+json')
        ->assertJsonPath('reason', 'not_found');
});

it('speaks JSON-LD with IRIs and a total', function () {
    $json = $this->get('/api/units', ['Accept' => 'application/ld+json'])->assertOk()->json();

    expect($json['member'][0]['@id'])->toStartWith('/api/units/')
        ->and($json['totalItems'])->toBe(Unit::query()->whereNull('archived_at')->count());
});
