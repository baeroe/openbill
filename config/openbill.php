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
    | Reverse proxy (docs: reverse-proxy): addresses or CIDR ranges whose X-Forwarded-* headers are believed,
    | comma-separated (TRUSTED_PROXIES). Empty: localhost and the private networks (App\Support\TrustedRequests::PROXIES).
    | Restrict it to the proxy's address when other machines in those networks can reach the port.
    */
    'trusted_proxies' => env('TRUSTED_PROXIES'),

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

    /*
    | Template toolkit (POST /{locale}/templates/{id}/toolkit): the built kit that goes into the ZIP.
    | `pnpm build` writes it to packages/template-kit/dist/kit – in DDEV and in the Docker image (Dockerfile, stage assets).
    */
    'toolkit' => [
        'path' => env('OPENBILL_TOOLKIT_PATH', base_path('packages/template-kit/dist/kit')),
    ],

    /*
    | Request bodies under /api (App\Http\Middleware\LimitApiBody, 413 above). Template uploads
    | (POST /api/templates, PUT /api/templates/{id}/files) carry the package or base64 assets:
    | 20 MB unpacked assets as base64 (× 4/3) plus four sources. The Docker image lets 32M through nginx
    | (client_max_body_size) and PHP (post_max_size); DockerSetupTest keeps both at least max_template_body_bytes.
    */
    'api' => [
        'max_body_bytes' => 2 * 1024 * 1024,
        'max_template_body_bytes' => 30 * 1024 * 1024,
        // per valid token, otherwise per IP (editor autosave 600 ms + preview 250 ms ≈ 240/min)
        'requests_per_minute' => 600,
    ],

    /*
    | MCP server (/mcp, routes/ai.php): requests per minute per valid token, otherwise per IP. Bodies use
    | api.max_body_bytes (App\Http\Middleware\LimitApiBody).
    */
    'mcp' => [
        'requests_per_minute' => 300,
        // render-template-preview renders a PDF (Gotenberg) to count the pages; per token or user. Above it the
        // page count stays null (page_count_skipped: rate_limited) so finalizing keeps its Gotenberg
        'preview_pdfs_per_minute' => 20,
    ],
];
