<?php

use App\Support\TrustedRequests;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Middleware\TrustHosts;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpFoundation\Exception\SuspiciousOperationException;

// absolute http:// URLs: the test base URL comes from APP_URL (https in DDEV), which would make every request secure
beforeEach(function () {
    Route::get('/_proxy-check', fn (Request $request): array => ['secure' => $request->isSecure(), 'ip' => $request->ip()]);
});

it('trusts X-Forwarded-* from a reverse proxy in a private network', function (string $proxy) {
    $this->withServerVariables(['REMOTE_ADDR' => $proxy])
        ->get('http://localhost/_proxy-check', ['X-Forwarded-Proto' => 'https', 'X-Forwarded-Port' => '443', 'X-Forwarded-For' => '203.0.113.7'])
        ->assertOk()
        ->assertExactJson(['secure' => true, 'ip' => '203.0.113.7']);
})->with(['127.0.0.1', '::1', '10.1.2.3', '172.18.0.5', '192.168.1.20', 'fd00::5']);

it('ignores X-Forwarded-* sent straight from the internet', function () {
    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.9'])
        ->get('http://localhost/_proxy-check', ['X-Forwarded-Proto' => 'https', 'X-Forwarded-For' => '203.0.113.7'])
        ->assertOk()
        ->assertExactJson(['secure' => false, 'ip' => '198.51.100.9']);
});

it('derives exactly one host pattern from APP_URL, without subdomains or port', function () {
    expect(TrustedRequests::hostPatterns('https://invoices.example.com'))->toBe(['^invoices\.example\.com$'])
        ->and(TrustedRequests::hostPatterns('http://localhost:7739'))->toBe(['^localhost$'])
        ->and(TrustedRequests::hostPatterns('https://Invoices.Example.com/sub/'))->toBe(['^invoices\.example\.com$'])
        // unusable APP_URL: localhost only, never "every host"
        ->and(TrustedRequests::hostPatterns(''))->toBe(['^localhost$'])
        ->and(TrustedRequests::hostPatterns(null))->toBe(['^localhost$']);
});

it('registers TrustHosts globally with the host of APP_URL', function () {
    config(['app.url' => 'https://invoices.example.com']);

    expect(app(Kernel::class)->hasMiddleware(TrustHosts::class))->toBeTrue()
        ->and(app(TrustHosts::class)->hosts())->toBe(['^invoices\.example\.com$']);
});

it('rejects a foreign Host header once the patterns apply', function () {
    Request::setTrustedHosts(TrustedRequests::hostPatterns('https://invoices.example.com'));

    try {
        expect(Request::create('https://invoices.example.com/en/login')->getHost())->toBe('invoices.example.com')
            ->and(fn () => Request::create('https://evil.example/en/login')->getHost())->toThrow(SuspiciousOperationException::class)
            ->and(fn () => Request::create('https://a.invoices.example.com/en/login')->getHost())->toThrow(SuspiciousOperationException::class);
    } finally {
        Request::setTrustedHosts([]);
    }
});
