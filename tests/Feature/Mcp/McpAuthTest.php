<?php

use App\Actions\IssueApiToken;
use App\Actions\RevokeApiToken;
use App\Models\PersonalAccessToken;
use App\Models\Template;
use App\Models\User;

/*
 * Review focus 5 for POST /mcp: only tokens with the ability "mcp" get in. No token or a revoked/expired one: 401,
 * a token without "mcp": 403. The session of the UI never gets in (ApiAccess::MCP).
 */

const MCP_TOOLS_LIST = ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'tools/list'];

it('answers without a token with 401 and a bearer challenge, also without an Accept header', function () {
    $this->postJson('/mcp', MCP_TOOLS_LIST)
        ->assertUnauthorized()
        ->assertHeader('WWW-Authenticate', 'Bearer realm="mcp", error="invalid_token"');
    // MCP clients do not always send Accept: application/json – never a redirect to the login page
    $this->post('/mcp', MCP_TOOLS_LIST)->assertUnauthorized();
});

it('lets in only tokens with the mcp ability', function (array $abilities, int $status) {
    $templateId = in_array('templates:write', $abilities, true) ? Template::factory()->create()->id : null;

    $this->withToken(apiToken($abilities, $templateId))->postJson('/mcp', MCP_TOOLS_LIST)->assertStatus($status);
})->with([
    'mcp' => [['mcp'], 200],
    'mcp next to api:read' => [['api:read', 'mcp'], 200],
    'api:read' => [['api:read'], 403],
    'api:write' => [['api:write'], 403],
    'templates:render' => [['templates:render'], 403],
    'toolkit token' => [['templates:render', 'templates:write'], 403],
]);

it('lists the tools for an mcp token', function () {
    $tools = collect(mcpRpc(apiToken(['mcp']), 'tools/list')['result']['tools']);

    expect($tools->pluck('name'))->toContain('get-overview')
        ->and($tools->firstWhere('name', 'get-overview')['annotations']['readOnlyHint'])->toBeTrue();
});

it('shuts out a revoked token with 401', function () {
    $token = apiToken(['mcp']);
    $this->withToken($token)->postJson('/mcp', MCP_TOOLS_LIST)->assertOk();

    app(RevokeApiToken::class)->handle(systemActor(), PersonalAccessToken::findToken($token));
    forgetApiAuth();

    $this->withToken($token)->postJson('/mcp', MCP_TOOLS_LIST)->assertUnauthorized();
});

it('shuts out an expired token with 401', function () {
    $token = app(IssueApiToken::class)->handle(systemActor(), User::factory()->create(), [
        'name' => 'short-lived', 'abilities' => ['mcp'], 'expires_at' => now()->addHour()->toDateTimeString(),
    ])->plainTextToken;
    $this->travel(2)->hours();

    $this->withToken($token)->postJson('/mcp', MCP_TOOLS_LIST)->assertUnauthorized();
});

it('never lets the session of the UI in', function () {
    // /mcp has no session middleware, so a browser is a guest there (401). actingAs() fakes a session user anyway:
    // ApiAccess must still refuse the TransientToken
    $this->actingAs(User::factory()->create(), 'web')->postJson('/mcp', MCP_TOOLS_LIST)->assertForbidden();
});

it('limits requests per token', function () {
    config(['openbill.mcp.requests_per_minute' => 2]);
    $this->withToken(apiToken(['mcp']));

    $this->postJson('/mcp', MCP_TOOLS_LIST)->assertOk();
    $this->postJson('/mcp', MCP_TOOLS_LIST)->assertOk();
    $this->postJson('/mcp', MCP_TOOLS_LIST)->assertStatus(429);
});

it('refuses bodies above the API limit', function () {
    config(['openbill.api.max_body_bytes' => 1024]);

    $this->withToken(apiToken(['mcp']))
        ->postJson('/mcp', [...MCP_TOOLS_LIST, 'params' => ['padding' => str_repeat('x', 2048)]])
        ->assertStatus(413);
});

it('answers in German with Accept-Language de', function () {
    $this->withToken(apiToken(['api:read']))
        ->postJson('/mcp', MCP_TOOLS_LIST, ['Accept-Language' => 'de'])
        ->assertForbidden()
        ->assertJsonPath('message', __('api.problem.missing_ability', ['rule' => 'mcp'], 'de'));
});

it('shuts out the mcp token of a disabled user with 401 (review #8)', function () {
    $user = User::factory()->create();
    $token = apiToken(['mcp'], user: $user);
    $this->withToken($token)->postJson('/mcp', MCP_TOOLS_LIST)->assertOk();

    // set directly: DisableUser would also revoke the token, this checks the guard on its own
    $user->forceFill(['disabled_at' => now()])->save();
    forgetApiAuth();

    $this->withToken($token)->postJson('/mcp', MCP_TOOLS_LIST)->assertUnauthorized();
});
