<?php

namespace App\Providers;

use App\Contracts\DocumentArchiver;
use App\Rendering\PdfDocumentArchiver;
use Illuminate\Support\ServiceProvider;

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
        //
    }
}
