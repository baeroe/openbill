<?php

use App\Actions\IssueApiToken;
use App\Actions\RevokeApiToken;
use App\Http\Api\CurrentActor;
use App\Models\PersonalAccessToken;
use App\Models\Template;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

beforeEach(function () {
    Route::middleware('api')->prefix('api/_test')->group(function (): void {
        Route::get('/read', function (Request $request) {
            $actor = CurrentActor::from($request);

            return ['actor' => $actor->type->value, 'id' => $actor->id, 'user' => $actor->userId];
        })->middleware(['auth:sanctum', 'api.ability:read']);
        Route::post('/write', fn () => ['ok' => true])->middleware(['auth:sanctum', 'api.ability:write']);
        Route::post('/render', fn () => ['ok' => true])->middleware(['auth:sanctum', 'api.ability:render']);
        Route::put('/templates/{id}', fn () => ['ok' => true])->middleware(['auth:sanctum', 'api.ability:template-write']);
    });
});

it('answers requests without a token with 401 problem details', function () {
    $this->getJson('/api/_test/read')
        ->assertUnauthorized()
        ->assertHeader('Content-Type', 'application/problem+json')
        ->assertJsonPath('reason', 'unauthenticated');
});

it('lets api:read read but not write, and names the token as actor', function () {
    $user = User::factory()->create();
    $token = apiToken(['api:read'], user: $user);

    $this->withToken($token)->getJson('/api/_test/read')
        ->assertOk()
        ->assertJsonPath('actor', 'token')
        ->assertJsonPath('id', PersonalAccessToken::findToken($token)?->id)
        ->assertJsonPath('user', $user->id);
    $this->withToken($token)->postJson('/api/_test/write')
        ->assertForbidden()
        ->assertJsonPath('reason', 'forbidden')
        ->assertJsonPath('detail', 'This token may not do this (needs: write).');
});

it('keeps mcp and template tokens away from the REST resources', function (array $abilities) {
    $token = apiToken($abilities, in_array('templates:write', $abilities, true) ? Template::factory()->create()->id : null);

    $this->withToken($token)->getJson('/api/_test/read')->assertForbidden();
    $this->withToken($token)->postJson('/api/_test/write')->assertForbidden();
})->with([
    'mcp' => [['mcp']],
    'templates:render' => [['templates:render']],
    'templates:write' => [['templates:write']],
]);

it('lets templates:render and api:read render', function (array $abilities) {
    $this->withToken(apiToken($abilities))->postJson('/api/_test/render')->assertOk();
})->with([
    'templates:render' => [['templates:render']],
    'api:read' => [['api:read']],
]);

it('answers 401 once a token is revoked', function () {
    $token = apiToken(['api:read']);
    $this->withToken($token)->getJson('/api/_test/read')->assertOk();

    app(RevokeApiToken::class)->handle(systemActor(), PersonalAccessToken::findToken($token));
    forgetApiAuth();

    $this->withToken($token)->getJson('/api/_test/read')->assertUnauthorized();
});

it('answers 401 once a token has expired', function () {
    $token = app(IssueApiToken::class)->handle(systemActor(), User::factory()->create(), [
        'name' => 'short-lived', 'abilities' => ['api:read'], 'expires_at' => now()->addHour()->toDateTimeString(),
    ])->plainTextToken;
    $this->withToken($token)->getJson('/api/_test/read')->assertOk();

    $this->travel(2)->hours();
    forgetApiAuth();

    $this->withToken($token)->getJson('/api/_test/read')->assertUnauthorized();
});

it('binds templates:write to its own template', function () {
    [$own, $other] = Template::factory()->count(2)->create()->all();
    $token = apiToken(['templates:write'], $own->id);

    $this->withToken($token)->putJson("/api/_test/templates/{$own->id}")->assertOk();
    $this->withToken($token)->putJson("/api/_test/templates/{$other->id}")->assertForbidden();
});

it('records when a token was used last', function () {
    $token = apiToken(['api:read']);

    $this->withToken($token)->getJson('/api/_test/read')->assertOk();

    expect(PersonalAccessToken::findToken($token)?->last_used_at)->not->toBeNull();
});

it('lets the signed-in UI call the API with its session', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->withHeader('Referer', 'https://openbill.ddev.site/en/documents')
        ->getJson('/api/_test/read')
        ->assertOk()
        ->assertJsonPath('actor', 'user')
        ->assertJsonPath('id', $user->id);
    $this->actingAs($user)->postJson('/api/_test/write')->assertOk();
    $this->actingAs($user)->putJson('/api/_test/templates/'.Template::factory()->create()->id)->assertOk();
});

it('treats the DDEV host as first-party origin of the session UI', function () {
    $fromFrontend = fn (string $referer): bool => EnsureFrontendRequestsAreStateful::fromFrontend(
        Request::create('/api/documents', 'GET', server: ['HTTP_REFERER' => $referer]),
    );

    expect($fromFrontend('https://openbill.ddev.site/en/documents'))->toBeTrue()
        ->and($fromFrontend('https://unknown-site.example/'))->toBeFalse();
});

it('answers in the language of Accept-Language', function () {
    $this->withHeader('Accept-Language', 'de-DE,de;q=0.9,en;q=0.5')
        ->getJson('/api/_test/read')
        ->assertUnauthorized()
        ->assertJsonPath('title', 'Nicht angemeldet');
});
