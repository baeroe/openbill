<?php

namespace App\Http\Middleware;

use App\Support\TrustedRequests;
use Illuminate\Http\Middleware\TrustProxies as BaseTrustProxies;
use Illuminate\Http\Request;

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

    /**
     * X-Forwarded-For/-Host/-Port/-Proto only. openbill runs at the root of its host: X-Forwarded-Prefix (which
     * Laravel trusts by default) would end up in every generated URL, so not even a trusted proxy may set it.
     */
    protected function headers(): int
    {
        return Request::HEADER_X_FORWARDED_FOR | Request::HEADER_X_FORWARDED_HOST | Request::HEADER_X_FORWARDED_PORT | Request::HEADER_X_FORWARDED_PROTO;
    }
}
