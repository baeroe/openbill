<?php

use App\Http\Middleware\TrustProxies;
use App\Support\TrustedRequests;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Middleware\TrustHosts;
use Illuminate\Http\Middleware\TrustProxies as FrameworkTrustProxies;
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

it('ignores X-Forwarded-Prefix even from a trusted proxy: openbill runs at the root of its host (ledger phase 10)', function () {
    Route::get('/_prefix-check', fn (Request $request): array => ['base' => $request->getBaseUrl(), 'secure' => $request->isSecure()]);

    $this->withServerVariables(['REMOTE_ADDR' => '10.1.2.3'])
        ->get('http://localhost/_prefix-check', ['X-Forwarded-Prefix' => '/elsewhere', 'X-Forwarded-Proto' => 'https'])
        ->assertOk()
        ->assertExactJson(['base' => '', 'secure' => true]);
});

it('trusts only the proxies of TRUSTED_PROXIES once they are set', function () {
    config(['openbill.trusted_proxies' => '192.0.2.10, 2001:db8::10']);

    foreach (['192.0.2.10', '2001:db8::10'] as $proxy) {
        $this->withServerVariables(['REMOTE_ADDR' => $proxy])
            ->get('http://localhost/_proxy-check', ['X-Forwarded-Proto' => 'https', 'X-Forwarded-For' => '203.0.113.7'])
            ->assertExactJson(['secure' => true, 'ip' => '203.0.113.7']);
    }
    // a machine in a private network (e.g. the Docker gateway) is no proxy any more
    $this->withServerVariables(['REMOTE_ADDR' => '172.18.0.1'])
        ->get('http://localhost/_proxy-check', ['X-Forwarded-Proto' => 'https', 'X-Forwarded-For' => '203.0.113.7'])
        ->assertExactJson(['secure' => false, 'ip' => '172.18.0.1']);
});

it('parses TRUSTED_PROXIES and falls back to the private networks', function () {
    expect(TrustedRequests::parseProxies('192.0.2.10, 198.51.100.0/24 ,'))->toBe(['192.0.2.10', '198.51.100.0/24'])
        ->and(TrustedRequests::parseProxies(['192.0.2.10']))->toBe(['192.0.2.10'])
        ->and(TrustedRequests::parseProxies(''))->toBe(TrustedRequests::PROXIES)
        ->and(TrustedRequests::parseProxies(' , '))->toBe(TrustedRequests::PROXIES)
        ->and(TrustedRequests::parseProxies(null))->toBe(TrustedRequests::PROXIES);
});

it('replaces the framework TrustProxies with the configurable one', function () {
    $kernel = app(Kernel::class);

    expect($kernel->hasMiddleware(TrustProxies::class))->toBeTrue()
        ->and($kernel->hasMiddleware(FrameworkTrustProxies::class))->toBeFalse();
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
