<?php

use App\Models\PersonalAccessToken;
use App\Models\Template;
use App\Models\User;

it('lists only the own tokens, newest first, toolkit tokens marked, never the secret', function () {
    $user = User::factory()->create();
    $template = Template::factory()->create(['name' => 'Fjord']);
    apiToken(['mcp'], user: $user);
    $this->travel(1)->minutes();
    apiToken(['templates:render', 'templates:write'], $template->id, $user);
    apiToken(['api:read']); // another user's

    $rows = $this->actingAs($user, 'web')->getJson('/api/tokens')->assertOk()->json();

    expect($rows)->toHaveCount(2)
        ->and($rows[0])->toMatchArray(['abilities' => ['templates:render', 'templates:write'], 'template_id' => $template->id, 'template_name' => 'Fjord', 'is_toolkit' => true, 'last_used_at' => null])
        ->and($rows[1])->toMatchArray(['abilities' => ['mcp'], 'template_id' => null, 'template_name' => null, 'is_toolkit' => false])
        ->and($rows[0])->toHaveKeys(['id', 'name', 'created_at', 'expires_at'])
        ->and(json_encode($rows))->not->toContain('openbill_');
});

it('creates a token, shows the secret only in this answer, and the token works for MCP', function () {
    $user = User::factory()->create();

    $created = $this->actingAs($user, 'web')
        ->postJson('/api/tokens', ['name' => 'Claude Code on the laptop', 'abilities' => ['mcp'], 'template_id' => 'ignored'])
        ->assertCreated()
        ->assertJsonPath('token.name', 'Claude Code on the laptop')
        ->assertJsonPath('token.abilities', ['mcp'])
        ->assertJsonPath('token.is_toolkit', false)
        ->json();

    expect($created['plain_text_token'])->toContain('|openbill_')
        ->and(json_encode($this->getJson('/api/tokens')->json()))->not->toContain($created['plain_text_token']);

    forgetApiAuth();
    $this->withToken($created['plain_text_token'])->postJson('/mcp', ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'tools/list'])->assertOk();
    expect(PersonalAccessToken::query()->sole()->last_used_at)->not->toBeNull();
});

it('refuses toolkit tokens, unknown abilities and empty names with their paths', function (array $body, string $path) {
    $this->actingAs(User::factory()->create(), 'web')
        ->postJson('/api/tokens', $body)
        ->assertUnprocessable()
        ->assertJsonPath('violations.0.path', $path);

    expect(PersonalAccessToken::query()->count())->toBe(0);
})->with([
    'toolkit ability' => [['name' => 'Toolkit', 'abilities' => ['templates:render', 'templates:write']], 'abilities.1'],
    'unknown ability' => [['name' => 'Root', 'abilities' => ['admin']], 'abilities.0'],
    'no ability' => [['name' => 'Nothing', 'abilities' => []], 'abilities'],
    'empty name' => [['name' => '', 'abilities' => ['mcp']], 'name'],
]);

it('revokes own tokens only', function () {
    $user = User::factory()->create();
    $mine = PersonalAccessToken::findToken(apiToken(['mcp'], user: $user));
    $theirs = PersonalAccessToken::findToken(apiToken(['mcp']));

    $this->actingAs($user, 'web')->deleteJson("/api/tokens/{$theirs->id}")->assertNotFound();
    $this->deleteJson("/api/tokens/{$mine->id}")->assertNoContent();

    expect(PersonalAccessToken::query()->pluck('id')->all())->toBe([$theirs->id]);
});

it('keeps API tokens away from managing tokens', function () {
    $this->withToken(apiToken(['api:write', 'mcp']))->getJson('/api/tokens')->assertForbidden();
});
