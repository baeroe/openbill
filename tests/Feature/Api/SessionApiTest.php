<?php

use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;

/*
 * The own UI calls /api with its login session (Sanctum "stateful"): only from its own origin and, for
 * writes, only with the CSRF token. Laravel skips CSRF checks in tests, so the real check is switched on
 * here, and the session travels as a cookie like in the browser (no actingAs).
 */
beforeEach(function () {
    app()->bind(ValidateCsrfToken::class, fn ($app) => new class($app, $app['encrypter']) extends ValidateCsrfToken
    {
        protected function runningUnitTests(): bool
        {
            return false;
        }
    });

    // a real session store, so nothing of the login request survives in memory
    config(['session.driver' => 'file']);
    app('session')->forgetDrivers();
    app()->forgetInstance('session.store');

    User::factory()->create(['email' => 'anna@example.com', 'password' => 'secret-password']);
    $this->post('/en/login', ['email' => 'anna@example.com', 'password' => 'secret-password', '_token' => csrf_token()])->assertRedirect();
    $this->sessionId = app('session')->getId();
    $this->csrf = app('session')->token();
    app('session')->driver()->save();
    app('session')->forgetDrivers();
    app()->forgetInstance('session.store');
    forgetApiAuth(); // from here on only the session cookie identifies the user
});

function sessionRequest(object $test, string $origin): object
{
    return $test->withCredentials()->withCookie(config('session.cookie'), $test->sessionId)
        ->withHeader('Origin', $origin)
        ->withHeader('Referer', "{$origin}/en/documents");
}

it('serves the own UI from its session', function () {
    sessionRequest($this, 'https://openbill.ddev.site')->getJson('/api/documents')->assertOk();
});

it('ignores the session for requests from a foreign origin', function () {
    sessionRequest($this, 'https://evil.example')->getJson('/api/documents')
        ->assertUnauthorized()
        ->assertJsonPath('reason', 'unauthenticated');
});

it('refuses writes of the own UI without the CSRF token with 419 problem details', function () {
    sessionRequest($this, 'https://openbill.ddev.site')->postJson('/api/customers', ['name' => 'Studio Nordlicht'])
        ->assertStatus(419)
        ->assertHeader('Content-Type', 'application/problem+json')
        ->assertJsonPath('reason', 'csrf_token_mismatch');
    expect(Customer::query()->count())->toBe(0);

    sessionRequest($this, 'https://openbill.ddev.site')->withHeader('X-CSRF-TOKEN', $this->csrf)
        ->postJson('/api/customers', ['name' => 'Studio Nordlicht'])
        ->assertCreated();
});

it('checks CSRF in the stateful middleware of Sanctum', function () {
    expect(config('sanctum.middleware.validate_csrf_token'))->toBe(ValidateCsrfToken::class);
});
