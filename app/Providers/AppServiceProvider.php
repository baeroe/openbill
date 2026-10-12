<?php

namespace App\Providers;

use ApiPlatform\OpenApi\Factory\OpenApiFactoryInterface;
use App\Auth\ActiveUserProvider;
use App\Contracts\DocumentArchiver;
use App\Models\PersonalAccessToken;
use App\Models\User;
use App\OpenApi\OpenApiFactory;
use App\Rendering\PdfDocumentArchiver;
use App\Support\Cache\MetadataStore;
use Illuminate\Cache\CacheManager;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Contracts\Cache\Repository;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(DocumentArchiver::class, PdfDocumentArchiver::class);

        // store "api-platform": APCu or array, decided per process (not frozen by config:cache). Registered
        // when the cache manager is made: API Platform's provider may use the store before boot() of this one
        $this->app->afterResolving('cache', fn (CacheManager $cache) => $cache->extend(
            MetadataStore::DRIVER,
            fn (Application $app): Repository => $cache->repository(MetadataStore::make()),
        ));

        // routes/api.php in the OpenAPI document (/api/docs); api:openapi:export uses API Platform's concrete factory
        $this->app->extend(OpenApiFactoryInterface::class, fn (OpenApiFactoryInterface $factory): OpenApiFactoryInterface => new OpenApiFactory($factory));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);

        // disabled accounts: no session login (provider) and no token, even one issued before (DisableUser deletes them too)
        Auth::provider('active-eloquent', fn (Application $app, array $config): ActiveUserProvider => new ActiveUserProvider($app['hash'], $config['model']));
        Sanctum::authenticateAccessTokensUsing(fn (PersonalAccessToken $token, bool $isValid): bool => $isValid && ! ($token->tokenable instanceof User && $token->tokenable->isDisabled()));

        // editor autosave (600 ms) and preview (250 ms) stay well below this per open editor
        // only a valid token gets its own bucket; anything else (no token, made-up tokens) shares the IP's
        RateLimiter::for('api', function (Request $request): Limit {
            $bearer = $request->bearerToken();
            $token = $bearer !== null ? PersonalAccessToken::findToken($bearer) : null;
            $valid = $token !== null && ($token->expires_at === null || $token->expires_at->isFuture());

            return Limit::perMinute((int) config('openbill.api.requests_per_minute'))
                ->by($valid ? 'token:'.$token->getKey() : 'ip:'.$request->ip());
        });
    }
}
