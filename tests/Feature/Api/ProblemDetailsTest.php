<?php

use App\Domain\Compliance\ComplianceIssue;
use App\Domain\Compliance\ComplianceRule;
use App\Exceptions\ActionNotAllowedException;
use App\Exceptions\ComplianceFailedException;
use App\Exceptions\DocumentLockedException;
use App\Http\Api\RequestBody;
use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;

beforeEach(function () {
    Route::middleware('api')->prefix('api/_test')->group(function (): void {
        Route::get('/locked', fn () => throw new DocumentLockedException('01JAAAAAAAAAAAAAAAAAAAAAAA', 'INV-2026-0007'));
        Route::get('/not-allowed', fn () => throw ActionNotAllowedException::duplicateCancellation());
        Route::get('/invalid', fn () => throw ValidationException::withMessages(['groups.0.positions.1.custom.ticket' => ['Ticket must be text.']]));
        Route::get('/compliance', fn () => throw new ComplianceFailedException([new ComplianceIssue('customer.address', ComplianceRule::CustomerAddressIncomplete)]));
        Route::get('/missing', fn () => Customer::query()->findOrFail('01JAAAAAAAAAAAAAAAAAAAAAAA'));
        Route::get('/boom', fn () => throw new RuntimeException('secret internals'));
        Route::post('/body', fn (Request $request) => RequestBody::object($request));
    });
});

it('answers a locked document with 409 problem details', function () {
    $this->getJson('/api/_test/locked')
        ->assertStatus(409)
        ->assertHeader('Content-Type', 'application/problem+json')
        ->assertExactJson([
            'type' => 'urn:openbill:problem:document_locked',
            'title' => 'Conflict',
            'status' => 409,
            'detail' => 'INV-2026-0007 is finalized and can no longer be changed.',
            'reason' => 'document_locked',
            'document_id' => '01JAAAAAAAAAAAAAAAAAAAAAAA',
            'number' => 'INV-2026-0007',
        ]);
});

it('carries the stable reason of a refused action', function () {
    $this->getJson('/api/_test/not-allowed')
        ->assertStatus(409)
        ->assertJsonPath('reason', 'duplicate_cancellation')
        ->assertJsonPath('type', 'urn:openbill:problem:duplicate_cancellation')
        ->assertJsonPath('detail', 'Cancellations cannot be duplicated.');
});

it('lists validation errors with their dot paths', function () {
    $this->getJson('/api/_test/invalid')
        ->assertStatus(422)
        ->assertJsonPath('reason', 'validation_failed')
        ->assertJsonPath('title', 'Invalid input')
        ->assertJsonPath('violations', [['path' => 'groups.0.positions.1.custom.ticket', 'message' => 'Ticket must be text.']]);
});

it('lists compliance issues with path, message and a stable code', function () {
    $this->getJson('/api/_test/compliance')
        ->assertStatus(422)
        ->assertJsonPath('reason', 'compliance_failed')
        ->assertJsonPath('violations', [[
            'path' => 'customer.address',
            'message' => 'Customer: the address is incomplete.',
            'code' => 'customer_address_incomplete',
        ]]);
});

it('answers a missing model with 404 without naming classes', function () {
    $response = $this->getJson('/api/_test/missing')->assertNotFound()->assertJsonPath('reason', 'not_found');

    expect($response->json('detail'))->not->toContain('App\\Models');
});

it('hides internals of unexpected errors unless debugging', function () {
    config(['app.debug' => false]);

    $response = $this->getJson('/api/_test/boom')->assertStatus(500)->assertJsonPath('reason', 'server_error');

    expect($response->getContent())->not->toContain('secret internals');
});

it('refuses bodies that are not a JSON object with 400', function (string $body, string $detail) {
    $this->call('POST', '/api/_test/body', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'], content: $body)
        ->assertStatus(400)
        ->assertJsonPath('reason', 'bad_request')
        ->assertJsonPath('detail', $detail);
})->with([
    'broken JSON' => ['{"name": ', 'The request body is not valid JSON.'],
    'a list' => ['[1, 2]', 'The request body must be a JSON object.'],
]);

it('accepts an empty body as an empty object', function () {
    $this->call('POST', '/api/_test/body', server: ['HTTP_ACCEPT' => 'application/json'])->assertOk()->assertExactJson([]);
});

it('leaves web routes alone', function () {
    $response = $this->get('/en/does-not-exist');

    expect($response->status())->toBe(404)
        ->and((string) $response->headers->get('Content-Type'))->not->toContain('problem');
});
