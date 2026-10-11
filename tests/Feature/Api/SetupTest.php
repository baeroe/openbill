<?php

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Resource\ResourceMetadataCollection;
use App\ApiResource\UnitResource;
use App\Models\PersonalAccessToken;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
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

it('caches API Platform metadata in APCu, never in a store that refuses to unserialize objects', function () {
    expect(config('cache.stores.api-platform.driver'))->toBe('apc')
        ->and(config('api-platform.cache'))->toBe(function_exists('apcu_enabled') && apcu_enabled() ? 'api-platform' : 'array')
        ->and(config('api-platform.cache'))->not->toBeIn(['file', 'database', 'redis'])
        ->and(config('cache.serializable_classes'))->toBeFalse();
});

it('gets API Platform metadata back from the APCu store as objects', function () {
    $metadata = new ResourceMetadataCollection(UnitResource::class, [new ApiResource(shortName: 'Unit')]);
    Cache::store('api-platform')->forever('test-metadata', $metadata);

    expect(Cache::store('api-platform')->get('test-metadata'))->toBeInstanceOf(ResourceMetadataCollection::class);
})->skip(fn () => ! (function_exists('apcu_enabled') && apcu_enabled()), 'APCu is off in this PHP (CLI: apc.enable_cli)');
