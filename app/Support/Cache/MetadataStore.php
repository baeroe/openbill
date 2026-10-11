<?php

namespace App\Support\Cache;

use Illuminate\Cache\ApcStore;
use Illuminate\Cache\ApcWrapper;
use Illuminate\Cache\ArrayStore;
use Illuminate\Contracts\Cache\Store;

/**
 * Cache driver "apcu-or-array" of the store "api-platform" (API Platform metadata, config/cache.php).
 * Chooses per process when the store is first used – never while the config is loaded, so
 * `php artisan config:cache` in the CLI (APCu off) cannot freeze the choice: PHP-FPM with APCu gets APCu
 * (native serialization, not subject to cache.serializable_classes), CLI/CI without APCu a per-process array.
 */
final class MetadataStore
{
    public const DRIVER = 'apcu-or-array';

    public static function make(?bool $apcu = null): Store
    {
        $apcu ??= function_exists('apcu_enabled') && apcu_enabled();

        return $apcu ? new ApcStore(new ApcWrapper) : new ArrayStore;
    }
}
