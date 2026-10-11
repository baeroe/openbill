<?php

return [
    /*
     * Owner account created on start by `php artisan app:ensure-admin`.
     * Read through config (not env()) so it also works with a cached config.
     */
    'admin' => [
        'email' => env('ADMIN_EMAIL'),
        'password' => env('ADMIN_PASSWORD'),
    ],

    /*
    | Limits for Liquid templates (see docs/en/templates.md, "Limits and errors").
    */
    'rendering' => [
        'max_source_bytes' => 200 * 1024,     // per part: header, body, footer, styles
        'max_output_bytes' => 5 * 1024 * 1024, // rendered HTML per part
        'max_render_score' => 200_000,        // Liquid nodes and loop iterations per part
        'max_assign_score' => 50_000,         // assign/capture work per part
        'max_range' => 10_000,                // items in a range like (1..n)
        'max_memory_bytes' => 128 * 1024 * 1024, // memory one rendering may add (PHP-FPM runs with 512 MB)
        'max_seconds' => 5,                   // wall clock for all parts of one rendering (finalize holds the number lock)
    ],

    /*
    | Template packages (ZIP import).
    */
    'templates' => [
        'max_package_bytes' => 10 * 1024 * 1024,
        'max_unpacked_bytes' => 20 * 1024 * 1024,
        'max_entries' => 100,
        'max_asset_bytes' => 2 * 1024 * 1024,
    ],
];
