<?php

namespace App\Support;

/**
 * Which requests openbill believes (docs: reverse-proxy).
 *
 * - Proxies: X-Forwarded-For/-Proto/-Host/-Port only from localhost and private networks, where a reverse proxy
 *   (Caddy, Traefik, nginx, Docker's own network) sits. A client on the internet that hits the published port
 *   directly can't fake https or its IP (the login throttle counts per IP).
 * - Hosts: only the host of APP_URL (no subdomains). Laravel applies it outside `local` and tests; any other Host
 *   header answers 400, so no link or redirect is ever built from a foreign host.
 */
final class TrustedRequests
{
    /** @var list<string> */
    public const PROXIES = ['127.0.0.1', '::1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 'fc00::/7'];

    /**
     * Patterns for Request::setTrustedHosts(): the host of APP_URL, case-insensitive, without port.
     * An unusable APP_URL trusts localhost only, never every host.
     *
     * @return list<string>
     */
    public static function hostPatterns(mixed $appUrl): array
    {
        $host = is_string($appUrl) ? parse_url($appUrl, PHP_URL_HOST) : null;

        if (! is_string($host) || $host === '') {
            $host = 'localhost';
        }

        return ['^'.preg_quote(strtolower($host)).'$'];
    }
}
