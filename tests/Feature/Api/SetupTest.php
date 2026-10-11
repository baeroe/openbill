<?php

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Resource\ResourceMetadataCollection;
use App\ApiResource\UnitResource;
use App\Models\PersonalAccessToken;
use App\Models\User;
use App\Support\Cache\MetadataStore;
use Illuminate\Cache\ApcStore;
use Illuminate\Cache\ArrayStore;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\Process\Process;

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

it('caches API Platform metadata in a store that never unserializes objects through Laravel', function () {
    expect(config('cache.stores.api-platform.driver'))->toBe(MetadataStore::DRIVER)
        ->and(config('api-platform.cache'))->toBe('api-platform')
        ->and(config('cache.serializable_classes'))->toBeFalse();
});

it('keeps the APCu decision out of the config, so config:cache in the CLI cannot freeze it', function () {
    // what config:cache does: load the files in the CLI (APCu off here) and export them
    $apiPlatform = require config_path('api-platform.php');
    $cache = require config_path('cache.php');
    $exported = var_export(['api-platform' => $apiPlatform, 'cache' => $cache], true);

    // whatever the loading process has (CLI: APCu off), the exported config names the runtime store
    expect($apiPlatform['cache'])->toBe('api-platform')
        ->and($cache['stores']['api-platform']['driver'])->toBe(MetadataStore::DRIVER)
        ->and($exported)->not->toContain('Closure');
});

it('chooses APCu or a per-process array when the store is used', function () {
    expect(MetadataStore::make(true))->toBeInstanceOf(ApcStore::class)
        ->and(MetadataStore::make(false))->toBeInstanceOf(ArrayStore::class)
        ->and(Cache::store('api-platform')->getStore())->toBeInstanceOf(function_exists('apcu_enabled') && apcu_enabled() ? ApcStore::class : ArrayStore::class);
});

it('gets API Platform metadata back from the APCu store as objects', function () {
    $metadata = new ResourceMetadataCollection(UnitResource::class, [new ApiResource(shortName: 'Unit')]);
    Cache::store('api-platform')->forever('test-metadata', $metadata);

    expect(Cache::store('api-platform')->get('test-metadata'))->toBeInstanceOf(ResourceMetadataCollection::class);
})->skip(fn () => ! (function_exists('apcu_enabled') && apcu_enabled()), 'APCu is off in this PHP (CLI: apc.enable_cli)');

it('boots without debug, where API Platform uses the metadata store while providers boot', function () {
    // composer install (post-autoload-dump) runs artisan exactly like this in CI and in the Docker build
    $process = new Process(['php', 'artisan', 'route:list', '--path=api/units'], base_path(), ['APP_DEBUG' => 'false']);
    $process->run();

    expect($process->getExitCode())->toBe(0, $process->getErrorOutput().$process->getOutput())
        ->and($process->getOutput())->toContain('api/units');
});
