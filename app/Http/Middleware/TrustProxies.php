<?php

namespace App\Http\Middleware;

use App\Support\TrustedRequests;
use Illuminate\Http\Middleware\TrustProxies as BaseTrustProxies;

/**
 * Laravel's TrustProxies with the proxy list read per request from config (TRUSTED_PROXIES), so it works with a
 * cached config and in tests; bootstrap/app.php replaces the framework middleware with this one.
 */
class TrustProxies extends BaseTrustProxies
{
    /** @return list<string> */
    protected function proxies(): array
    {
        return TrustedRequests::proxies();
    }
}
