<?php

use App\Http\Api\ApiMiddleware;
use App\Http\Controllers\Api\DocumentPdfController;
use App\Http\Controllers\Api\DocumentXmlController;
use App\Http\Controllers\Api\SignedDownloadController;
use App\Http\Controllers\Api\TemplatePackageController;
use Illuminate\Support\Facades\Route;

/*
 * API Platform registers the resource routes (app/ApiResource). These are the endpoints that answer
 * with files or with action results as they are; App\OpenApi\OpenApiFactory documents them.
 * Prefix /api and the "api" middleware group come from bootstrap/app.php.
 */

Route::middleware(ApiMiddleware::READ)->group(function (): void {
    Route::get('/documents/{id}/pdf', DocumentPdfController::class)->name('api.documents.pdf');
    Route::get('/documents/{id}/xml', DocumentXmlController::class)->name('api.documents.xml');
});

// signed links (MCP get-document-pdf-url, 15 minutes): no token, the signature is the permission
Route::get('/downloads/documents/{id}/{kind}', SignedDownloadController::class)
    ->whereIn('kind', ['pdf', 'xml'])
    ->middleware(['signed:relative', 'throttle:60,1'])
    ->name('api.downloads');

Route::get('/templates/{id}/package', TemplatePackageController::class)
    ->middleware(ApiMiddleware::TEMPLATE_READ)
    ->name('api.templates.package');
