<?php

use App\Exceptions\PdfRenderFailedException;
use App\Rendering\GotenbergClient;
use App\Rendering\Paper;
use App\Rendering\RenderResult;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\Support\GotenbergFake;

function sampleResult(): RenderResult
{
    return new RenderResult('<html>HEADER</html>', '<html>BODY</html>', '<html>FOOTER</html>', new Paper('A4', '16mm', '16mm', '18mm'));
}

/** Value of a multipart form field in a recorded request. */
function formValue(Request $request, string $name): ?string
{
    return preg_match('/name="'.preg_quote($name, '/').'"[^\r\n]*\r\n(?:[^\r\n]+\r\n)*\r\n(.*?)\r\n--/s', $request->body(), $m) === 1 ? $m[1] : null;
}

it('sends body, header and footer with paper size, margins and backgrounds to the Chromium route', function () {
    $pdf = app(GotenbergClient::class)->pdf(sampleResult());

    expect($pdf)->toStartWith('%PDF-');
    Http::assertSent(function (Request $request): bool {
        return $request->url() === config('services.gotenberg.url').'/forms/chromium/convert/html'
            && formValue($request, 'paperWidth') === '210mm'
            && formValue($request, 'paperHeight') === '297mm'
            && formValue($request, 'marginTop') === '16mm'
            && formValue($request, 'marginBottom') === '18mm'
            && formValue($request, 'marginLeft') === '16mm'
            && formValue($request, 'marginRight') === '16mm'
            && formValue($request, 'printBackground') === '1'
            && str_contains($request->body(), 'filename="index.html"') && str_contains($request->body(), '<html>BODY</html>')
            && str_contains($request->body(), 'filename="header.html"') && str_contains($request->body(), '<html>HEADER</html>')
            && str_contains($request->body(), 'filename="footer.html"') && str_contains($request->body(), '<html>FOOTER</html>')
            && formValue($request, 'pdfa') === null
            && ! str_contains($request->body(), 'facturx');
    });
});

it('asks for PDF/A-3b with the XML embedded as factur-x.xml when an e-invoice is given', function () {
    app(GotenbergClient::class)->pdf(sampleResult(), '<rsm:CrossIndustryInvoice/>');

    Http::assertSent(fn (Request $request): bool => formValue($request, 'pdfa') === 'PDF/A-3b'
        && formValue($request, 'facturxConformanceLevel') === 'EN 16931'
        && formValue($request, 'facturxDocumentType') === 'INVOICE'
        && str_contains($request->body(), 'name="facturxXml"; filename="factur-x.xml"')
        && str_contains($request->body(), '<rsm:CrossIndustryInvoice/>'));
});

it('turns errors, timeouts and non-PDF answers into PdfRenderFailedException (503)', function (Closure $arrange) {
    $arrange();

    try {
        app(GotenbergClient::class)->pdf(sampleResult());
        $this->fail('no exception');
    } catch (PdfRenderFailedException $e) {
        expect($e->status())->toBe(503)->and($e->getMessage())->not->toBe('');
    }
})->with([
    'error answer' => [fn () => GotenbergFake::failWithError()],
    'timeout' => [fn () => GotenbergFake::timeOut()],
    'no PDF' => [fn () => GotenbergFake::answerWithHtml()],
]);

