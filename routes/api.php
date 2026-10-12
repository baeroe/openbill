<?php

use App\Http\Api\ApiMiddleware;
use App\Http\Controllers\Api\ApiTokensController;
use App\Http\Controllers\Api\DocumentPdfController;
use App\Http\Controllers\Api\DocumentXmlController;
use App\Http\Controllers\Api\FieldOrderController;
use App\Http\Controllers\Api\InvitationsController;
use App\Http\Controllers\Api\NumberPreviewController;
use App\Http\Controllers\Api\OrganizationLogoController;
use App\Http\Controllers\Api\PositionSuggestionsController;
use App\Http\Controllers\Api\RenderController;
use App\Http\Controllers\Api\RenderSchemaController;
use App\Http\Controllers\Api\RenderSourcesController;
use App\Http\Controllers\Api\SignedDownloadController;
use App\Http\Controllers\Api\TemplatePackageController;
use App\Http\Controllers\Api\UploadController;
use App\Http\Controllers\Api\UsersController;
use Illuminate\Support\Facades\Route;

/*
 * API Platform registers the resource routes (app/ApiResource). These are the endpoints that answer
 * with files or with action results as they are; App\OpenApi\OpenApiFactory documents them.
 * Prefix /api and the "api" middleware group come from bootstrap/app.php.
 */

Route::middleware(ApiMiddleware::READ)->group(function (): void {
    Route::get('/documents/{id}/pdf', DocumentPdfController::class)->name('api.documents.pdf');
    Route::get('/documents/{id}/xml', DocumentXmlController::class)->name('api.documents.xml');
    Route::get('/position-suggestions', PositionSuggestionsController::class)->name('api.position-suggestions');
    Route::get('/uploads/{name}', [UploadController::class, 'show'])
        ->where('name', '[0-9a-z]{26}\.(png|jpg|jpeg|gif|webp|svg)')
        ->name('api.uploads.show');
    Route::get('/organization/logo', [OrganizationLogoController::class, 'show'])->name('api.organization.logo');
    Route::get('/document-types/{type}/number-preview', NumberPreviewController::class)->name('api.document-types.number-preview');
});

Route::middleware(ApiMiddleware::WRITE)->group(function (): void {
    Route::post('/uploads', [UploadController::class, 'store'])->name('api.uploads.store');
    Route::post('/field-definitions/reorder', FieldOrderController::class)->name('api.field-definitions.reorder');
    Route::post('/organization/logo', [OrganizationLogoController::class, 'store'])->name('api.organization.logo.store');
    Route::delete('/organization/logo', [OrganizationLogoController::class, 'destroy'])->name('api.organization.logo.destroy');
});

Route::middleware(ApiMiddleware::RENDER)->group(function (): void {
    Route::post('/render', RenderController::class)->name('api.render');
    Route::get('/render/sources', RenderSourcesController::class)->name('api.render.sources');
    Route::get('/render/schema', RenderSchemaController::class)->name('api.render.schema');
});

// user management and the own API tokens: only the session of the own UI, never API tokens (not in the OpenAPI
// document). Accounts are disabled, never deleted (documents and their events keep their author)
Route::middleware(ApiMiddleware::SESSION)->group(function (): void {
    Route::get('/users', [UsersController::class, 'index'])->name('api.users');
    Route::patch('/users/{id}', [UsersController::class, 'update'])->whereUlid('id')->name('api.users.update');
    Route::post('/users/{id}/disable', [UsersController::class, 'disable'])->whereUlid('id')->name('api.users.disable');
    Route::post('/users/{id}/enable', [UsersController::class, 'enable'])->whereUlid('id')->name('api.users.enable');
    Route::post('/invitations', [InvitationsController::class, 'store'])->name('api.invitations.store');
    Route::delete('/invitations/{id}', [InvitationsController::class, 'destroy'])->whereUlid('id')->name('api.invitations.destroy');
    // tokens of the signed-in user (settings "API & MCP"); a token can never mint or revoke tokens
    Route::get('/tokens', [ApiTokensController::class, 'index'])->name('api.tokens');
    Route::post('/tokens', [ApiTokensController::class, 'store'])->name('api.tokens.store');
    Route::delete('/tokens/{id}', [ApiTokensController::class, 'destroy'])->whereUlid('id')->name('api.tokens.destroy');
});

// signed links (MCP get-document-pdf-url, 15 minutes): no token, the signature is the permission
Route::get('/downloads/documents/{id}/{kind}', SignedDownloadController::class)
    ->whereIn('kind', ['pdf', 'xml'])
    ->middleware(['signed:relative', 'throttle:60,1'])
    ->name('api.downloads');

Route::get('/templates/{id}/package', TemplatePackageController::class)
    ->middleware(ApiMiddleware::TEMPLATE_READ)
    ->name('api.templates.package');

// API Platform's own error pages (/api/errors/{status}) are no data: same URI as API Platform's route, so this
// one replaces it (registered later) and answers 404 like any unknown path
Route::get('/errors/{status}{_format?}', fn () => abort(404))->name('api.errors');
