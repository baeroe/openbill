<?php

namespace App\Providers;

use App\Contracts\DocumentArchiver;
use App\Support\NullDocumentArchiver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // phase 3 binds the PDF/XML archiver here
        $this->app->bind(DocumentArchiver::class, NullDocumentArchiver::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
