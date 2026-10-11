<?php

use App\Models\Unit;

beforeEach(fn () => $this->withToken(apiToken()));

it('answers a method an endpoint does not have with 405 problem details', function () {
    $this->deleteJson('/api/organization')
        ->assertStatus(405)
        ->assertHeader('Content-Type', 'application/problem+json')
        ->assertJsonPath('reason', 'method_not_allowed');
});

it('hides internals of an error inside an API Platform operation unless debugging', function () {
    config(['app.debug' => false]);
    // fails deep inside the processor → action → model of POST /api/units
    Unit::creating(fn () => throw new RuntimeException('secret internals of the operation'));

    $response = $this->postJson('/api/units', ['name' => 'Lump sum', 'symbol' => 'ls', 'decimals' => 0, 'code' => 'LS'])
        ->assertStatus(500)
        ->assertHeader('Content-Type', 'application/problem+json')
        ->assertJsonPath('reason', 'server_error');

    expect($response->getContent())->not->toContain('secret internals')
        ->and($response->getContent())->not->toContain('trace');
});

it('does not serve API Platform error pages as data', function (string $path) {
    $this->getJson($path)
        ->assertNotFound()
        ->assertHeader('Content-Type', 'application/problem+json')
        ->assertJsonPath('reason', 'not_found');
})->with(['/api/errors/500', '/api/errors/404', '/api/validation_errors/abc']);
