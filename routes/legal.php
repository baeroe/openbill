<?php

use App\Http\Controllers\LegalController;
use Illuminate\Support\Facades\Route;

// Public texts (finalized, public text documents without customer) as PDF. No session, no cookies, no language
// prefix: the answer is the same for everybody and may be cached.
Route::middleware('throttle:60,1')->prefix('legal')->group(function (): void {
    Route::get('/{slug}', LegalController::class)->where('slug', '[a-z0-9]+(-[a-z0-9]+)*')->name('legal.latest');
    Route::get('/{slug}/{number}', LegalController::class)->where('slug', '[a-z0-9]+(-[a-z0-9]+)*')->where('number', '[^/]+')->name('legal.version');
});
