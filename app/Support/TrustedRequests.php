<?php

namespace App\Support;

/**
 * Which requests openbill believes (docs: reverse-proxy).
 *
 * - Proxies: X-Forwarded-For/-Proto/-Host/-Port only from the addresses in config('openbill.trusted_proxies')
 *   (env TRUSTED_PROXIES), by default localhost and the private networks, where a reverse proxy (Caddy, Traefik,
 *   nginx, Docker's own network) sits. Anyone who reaches the port from a trusted address can set these headers,
 *   so the port is published on 127.0.0.1 by default and operators narrow the list to their proxy.
 * - Hosts: only the host of APP_URL (no subdomains). Laravel applies it outside `local` and tests; any other Host
 *   header answers 400, so no link or redirect is ever built from a foreign host.
 */
final class TrustedRequests
{
    /** @var list<string> */
    public const PROXIES = ['127.0.0.1', '::1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 'fc00::/7'];

    /**
     * Trusted proxies from config('openbill.trusted_proxies'): a comma-separated string (env) or a list.
     * Nothing configured: PROXIES.
     *
     * @return list<string>
     */
    public static function proxies(): array
    {
        return self::parseProxies(config('openbill.trusted_proxies'));
    }

    /** @return list<string> */
    public static function parseProxies(mixed $value): array
    {
        $items = match (true) {
            is_string($value) => explode(',', $value),
            is_array($value) => $value,
            default => [],
        };
        $proxies = array_values(array_filter(
            array_map(fn (mixed $item): string => is_string($item) ? trim($item) : '', $items),
            fn (string $item): bool => $item !== '',
        ));

        return $proxies === [] ? self::PROXIES : $proxies;
    }

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
