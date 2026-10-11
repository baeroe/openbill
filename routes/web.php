<?php

use App\Http\Controllers\LoginController;
use App\Http\Controllers\OverviewController;
use Illuminate\Support\Facades\Route;

// admin: the language is part of the URL (/en/…, /de/…)
Route::prefix('{locale}')->where(['locale' => 'en|de'])->group(function (): void {
    Route::middleware('guest')->group(function (): void {
        Route::get('/login', [LoginController::class, 'show'])->name('login');
        // per-account lockout lives in LoginRequest; this caps password spraying per address
        Route::post('/login', [LoginController::class, 'store'])->middleware('throttle:20,1');
    });

    Route::middleware('auth')->group(function (): void {
        Route::get('/', OverviewController::class)->name('home');
        Route::post('/logout', [LoginController::class, 'destroy'])->name('logout');
    });
});

// unprefixed entry points go to the remembered language (cookie), default English
Route::get('/', fn () => redirect('/'.app()->getLocale()));
Route::get('/login', fn () => redirect('/'.app()->getLocale().'/login'));
