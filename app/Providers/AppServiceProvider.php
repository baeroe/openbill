<?php

namespace App\Providers;

use App\Contracts\DocumentArchiver;
use App\Models\PersonalAccessToken;
use App\Rendering\PdfDocumentArchiver;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
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
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);

        // editor autosave (600 ms) and preview (250 ms) stay well below this per open editor
        RateLimiter::for('api', fn (Request $request): Limit => Limit::perMinute(600)->by(
            $request->bearerToken() !== null ? 'token:'.hash('sha256', $request->bearerToken()) : 'ip:'.$request->ip(),
        ));
    }
}
