<?php

namespace App\Support;

/**
 * Hosts whose browser requests get the session of the own UI (config/sanctum.php "stateful"): the host of
 * APP_URL, plus local development hosts (localhost, DDEV) outside production. Requests from elsewhere need a token.
 */
final class StatefulDomains
{
    public const DEV_HOSTS = ['localhost', 'localhost:3000', '127.0.0.1', '127.0.0.1:8000', '::1', 'openbill.ddev.site'];

    /**
     * @return list<string>
     */
    public static function list(string $environment, ?string $appUrl): array
    {
        $hosts = $environment === 'production' ? [] : self::DEV_HOSTS;

        $host = $appUrl !== null ? parse_url($appUrl, PHP_URL_HOST) : null;
        if (is_string($host) && $host !== '') {
            $port = parse_url((string) $appUrl, PHP_URL_PORT);
            $hosts[] = $host.(is_int($port) ? ":{$port}" : '');
        }

        return array_values(array_unique($hosts));
    }
}
