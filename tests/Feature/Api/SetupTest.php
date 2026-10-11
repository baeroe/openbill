<?php

use App\Models\PersonalAccessToken;
use App\Models\User;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

it('serves the OpenAPI document under /api/docs', function () {
    $this->get('/api/docs.jsonopenapi')
        ->assertOk()
        ->assertJsonPath('info.title', 'openbill API');
});

it('stores Sanctum tokens with ULID keys for ULID users and a template binding column', function () {
    $user = User::factory()->create();
    $new = $user->createToken('cli', ['api:read']);

    $token = PersonalAccessToken::findToken($new->plainTextToken);

    expect($token)->toBeInstanceOf(PersonalAccessToken::class)
        ->and(strlen((string) $token->getKey()))->toBe(26)
        ->and($token->tokenable->is($user))->toBeTrue()
        ->and($new->plainTextToken)->toContain('|openbill_')
        ->and(Schema::hasColumn('personal_access_tokens', 'template_id'))->toBeTrue();
});

it('leaves /mcp to laravel/mcp (phase 8)', function () {
    expect(Route::has('api_mcp'))->toBeFalse();
});

it('keeps API Platform metadata out of the persistent cache, which never unserializes objects', function () {
    // with a file/redis store and APP_DEBUG=false, metadata would come back as __PHP_Incomplete_Class
    expect(config('api-platform.cache'))->toBe('array')
        ->and(config('cache.serializable_classes'))->toBeFalse();
});
