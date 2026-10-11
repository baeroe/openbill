<?php

use App\Actions\IssueApiToken;
use App\Actions\RevokeApiToken;
use App\Models\PersonalAccessToken;
use App\Models\Template;
use App\Models\User;

it('issues a token with the given abilities', function () {
    $user = User::factory()->create();

    $new = app(IssueApiToken::class)->handle(systemActor(), $user, ['name' => 'Agent', 'abilities' => ['api:read', 'mcp']]);

    expect($new->accessToken->abilities)->toBe(['api:read', 'mcp'])
        ->and($new->accessToken->template_id)->toBeNull()
        ->and($user->tokens()->count())->toBe(1);
});

it('needs a template for templates:write and refuses one otherwise', function () {
    $user = User::factory()->create();
    $template = Template::factory()->create();
    $issue = fn (array $input) => app(IssueApiToken::class)->handle(systemActor(), $user, ['name' => 'Toolkit', ...$input]);

    expect(array_keys(validationErrors(fn () => $issue(['abilities' => ['templates:write']]))))->toBe(['template_id'])
        ->and(array_keys(validationErrors(fn () => $issue(['abilities' => ['api:read'], 'template_id' => $template->id]))))->toBe(['template_id'])
        ->and($issue(['abilities' => ['templates:render', 'templates:write'], 'template_id' => $template->id])->accessToken->template_id)->toBe($template->id);
});

it('refuses unknown abilities and the wildcard', function (string $ability) {
    $errors = validationErrors(fn () => app(IssueApiToken::class)->handle(systemActor(), User::factory()->create(), [
        'name' => 'x', 'abilities' => [$ability],
    ]));

    expect(array_keys($errors))->toBe(['abilities.0']);
})->with(['*', 'api:admin', 'templates:write:01JAAAAAAAAAAAAAAAAAAAAAAA']);

it('deletes toolkit tokens together with their template and revokes tokens', function () {
    $template = Template::factory()->create();
    apiToken(['templates:write'], $template->id);
    apiToken(['api:read']);

    $template->delete();
    expect(PersonalAccessToken::query()->count())->toBe(1);

    app(RevokeApiToken::class)->handle(systemActor(), PersonalAccessToken::query()->sole());
    expect(PersonalAccessToken::query()->count())->toBe(0);
});

it('prints a new token on the command line', function () {
    $user = User::factory()->create(['email' => 'nora@example.com']);

    $this->artisan('app:create-token', ['email' => 'nora@example.com', '--ability' => ['api:read', 'api:write']])
        ->expectsOutputToContain('|openbill_')
        ->assertSuccessful();

    expect($user->tokens()->sole()->abilities)->toBe(['api:read', 'api:write']);
});

it('fails on the command line for an unknown user or ability', function () {
    User::factory()->create(['email' => 'nora@example.com']);

    $this->artisan('app:create-token', ['email' => 'nobody@example.com'])->assertFailed();
    $this->artisan('app:create-token', ['email' => 'nora@example.com', '--ability' => ['root']])
        ->expectsOutputToContain('abilities.0')
        ->assertFailed();
});
