<?php

use App\Http\Controllers\HomeController;
use App\Http\Controllers\LoginController;
use Illuminate\Support\Facades\Route;

// admin: the language is part of the URL (/en/…, /de/…)
Route::prefix('{locale}')->where(['locale' => 'en|de'])->group(function (): void {
    Route::middleware('guest')->group(function (): void {
        Route::get('/login', [LoginController::class, 'show'])->name('login');
    });

    Route::middleware('auth')->group(function (): void {
        Route::get('/', HomeController::class)->name('home');
    });
});

// unprefixed entry points go to the remembered language (cookie), default English
Route::get('/', fn () => redirect('/'.app()->getLocale()));
Route::get('/login', fn () => redirect('/'.app()->getLocale().'/login'));
