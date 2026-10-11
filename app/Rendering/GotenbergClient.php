<?php

namespace App\Rendering;

use App\Exceptions\PdfRenderFailedException;
use Gotenberg\FacturX;
use Gotenberg\Gotenberg;
use Gotenberg\Stream;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/**
 * Gotenberg 8, Chromium route: body = index.html, header.html, footer.html, paper and margins from the
 * manifest (the header lives in the top margin, the footer in the bottom one), backgrounds printed.
 * With an e-invoice XML the result is PDF/A-3b with the XML embedded as factur-x.xml (Gotenberg ≥ 8.34).
 * gotenberg-php builds the multipart request, Laravel's HTTP client sends it (timeout, Http::fake in tests).
 */
final class GotenbergClient
{
    /**
     * @throws PdfRenderFailedException
     */
    public function pdf(RenderResult $result, ?string $facturXml = null): string
    {
        [$width, $height] = $result->paper->size();
        $builder = Gotenberg::chromium((string) config('services.gotenberg.url'))->pdf()
            ->paperSize($width, $height)
            ->margins($result->paper->headerHeight, $result->paper->footerHeight, $result->paper->marginX, $result->paper->marginX)
            ->printBackground()
            ->header(Stream::string('header.html', $result->header))
            ->footer(Stream::string('footer.html', $result->footer));
        if ($facturXml !== null) {
            $builder->pdfa('PDF/A-3b')
                ->facturX(new FacturX(Stream::string('factur-x.xml', $facturXml), FacturX::CONFORMANCE_EN_16931));
        }
        $request = $builder->html(Stream::string('index.html', $result->body));

        try {
            $response = Http::timeout((int) config('services.gotenberg.timeout'))
                ->withBody((string) $request->getBody(), $request->getHeaderLine('Content-Type'))
                ->post((string) $request->getUri());
        } catch (ConnectionException $e) {
            throw PdfRenderFailedException::unreachable($e);
        }

        if (! $response->successful() || ! str_starts_with($response->body(), '%PDF-')) {
            throw PdfRenderFailedException::answered($response->status(), $response->body());
        }

        return $response->body();
    }
}
