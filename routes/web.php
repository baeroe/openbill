<?php

use App\Http\Controllers\CustomerController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\FieldController;
use App\Http\Controllers\LoginController;
use App\Http\Controllers\OverviewController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\TemplateController;
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
        Route::get('/documents', [DocumentController::class, 'index'])->name('documents.index');
        Route::get('/documents/{id}', [DocumentController::class, 'show'])->whereUlid('id')->name('documents.show');
        Route::get('/customers', [CustomerController::class, 'index'])->name('customers.index');
        Route::get('/customers/new', [CustomerController::class, 'create'])->name('customers.create');
        Route::get('/customers/{id}', [CustomerController::class, 'show'])->whereUlid('id')->name('customers.show');
        Route::get('/templates', [TemplateController::class, 'index'])->name('templates.index');
        Route::get('/templates/{id}', [TemplateController::class, 'show'])->whereUlid('id')->name('templates.show');
        Route::get('/fields', [FieldController::class, 'index'])->name('fields.index');
        Route::get('/settings', [SettingsController::class, 'index'])->name('settings.index');
        Route::get('/settings/{section}', [SettingsController::class, 'show'])
            ->whereIn('section', SettingsController::SECTIONS)
            ->name('settings.show');
        Route::post('/logout', [LoginController::class, 'destroy'])->name('logout');
    });
});

// unprefixed entry points go to the remembered language (cookie), default English
Route::get('/', fn () => redirect('/'.app()->getLocale()));
Route::get('/login', fn () => redirect('/'.app()->getLocale().'/login'));
