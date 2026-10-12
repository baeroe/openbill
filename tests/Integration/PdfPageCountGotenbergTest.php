<?php

use App\Actions\RenderPreview;
use App\Rendering\GotenbergClient;
use App\Rendering\PdfPageCount;
use Smalot\PdfParser\Parser;

it('counts the pages of a real Chromium PDF like pdfparser does', function () {
    $preview = app(RenderPreview::class)->handle(systemActor(), ['scenario' => 'long_invoice', 'locale' => 'de']);
    $pdf = app(GotenbergClient::class)->pdf($preview->render);

    expect(PdfPageCount::of($pdf))
        ->toBe(count((new Parser)->parseContent($pdf)->getPages()))
        ->toBeGreaterThan(1);
})->group('gotenberg');
