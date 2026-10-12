<?php

/*
 * Keeps the self-hosting files consistent with the app and with each other: Dockerfile, .dockerignore, entrypoint,
 * docker-compose.yml, DDEV, CI and scripts (phase 10). Pure file checks; the image itself is verified by building it.
 */

function dockerRepoFile(string $path): string
{
    $file = base_path($path);
    expect(is_file($file))->toBeTrue("{$path} is missing");

    return (string) file_get_contents($file);
}

/** "32M" → bytes (PHP/nginx size notation). */
function dockerSizeBytes(string $size): int
{
    if (preg_match('/^(\d+)([KMG]?)$/i', trim($size), $m) !== 1) {
        throw new InvalidArgumentException("Unknown size {$size}");
    }

    return (int) $m[1] * match (strtoupper($m[2])) {
        'K' => 1024,
        'M' => 1024 ** 2,
        'G' => 1024 ** 3,
        default => 1,
    };
}

/** Value of NAME=value in the ENV instruction of the Dockerfile. */
function dockerfileEnv(string $name): string
{
    $found = preg_match('/^\s*(?:ENV\s+)?'.preg_quote($name, '/').'=(\S+?)(?:\s+\\\\)?$/m', dockerRepoFile('Dockerfile'), $m);
    expect($found)->toBe(1, "Dockerfile sets no {$name}");

    return $m[1];
}

it('pins every base image by version and digest', function () {
    preg_match_all('/^FROM\s+(?:--platform=\S+\s+)?(\S+)/m', dockerRepoFile('Dockerfile'), $m);

    expect($m[1])->toHaveCount(2);
    foreach ($m[1] as $image) {
        expect($image)->toMatch('/^[a-z0-9\/._-]+:[\w.-]+@sha256:[0-9a-f]{64}$/');
    }
});

it('builds assets and the template kit with pnpm from corepack, never npm', function () {
    $dockerfile = dockerRepoFile('Dockerfile');

    expect($dockerfile)->toContain('corepack enable', 'pnpm install --frozen-lockfile', 'RUN pnpm build')
        ->and(preg_match('/(?<![\w-])npm\b|npx\b/', $dockerfile))->toBe(0);
});

it('installs the PHP extensions the app needs on top of the base image', function () {
    expect(dockerRepoFile('Dockerfile'))->toMatch('/install-php-extensions\s+intl\s+bcmath\s+gd\s+apcu/');
});

it('lets template uploads through nginx and PHP and gives PHP the memory rendering expects', function () {
    $templateBody = (int) config('openbill.api.max_template_body_bytes');

    expect(dockerSizeBytes(dockerfileEnv('PHP_POST_MAX_SIZE')))->toBeGreaterThanOrEqual($templateBody)
        ->and(dockerSizeBytes(dockerfileEnv('NGINX_CLIENT_MAX_BODY_SIZE')))->toBeGreaterThanOrEqual($templateBody)
        ->and(dockerSizeBytes(dockerfileEnv('PHP_UPLOAD_MAX_FILE_SIZE')))->toBeGreaterThanOrEqual((int) config('openbill.templates.max_package_bytes'))
        ->and(dockerSizeBytes(dockerfileEnv('PHP_MEMORY_LIMIT')))->toBe(512 * 1024 ** 2)
        ->and(dockerfileEnv('APP_ENV'))->toBe('production')
        ->and(dockerfileEnv('APP_DEBUG'))->toBe('false');
});

it('ships the Liquid reference the MCP server reads at runtime', function () {
    $ignore = array_map('trim', explode("\n", dockerRepoFile('.dockerignore')));

    expect($ignore)->toContain('!docs/en/templates.md')
        ->and(dockerRepoFile('Dockerfile'))->toContain('COPY --chown=www-data:www-data docs/en/templates.md ./docs/en/templates.md');
});

it('puts the built template kit where config(openbill.toolkit.path) looks for it', function () {
    expect(config('openbill.toolkit.path'))->toBe(base_path('packages/template-kit/dist/kit'))
        ->and(dockerRepoFile('Dockerfile'))->toContain('--from=assets /app/packages/template-kit/dist/kit ./packages/template-kit/dist/kit');
});

it('keeps secrets, dependencies and local caches out of the build context', function () {
    $ignore = array_map('trim', explode("\n", dockerRepoFile('.dockerignore')));

    expect($ignore)->toContain('.env', '.env.*', '**/node_modules', 'vendor', 'storage', 'bootstrap/cache/*.php', '.git', '.ddev', 'e2e', 'tests');
});
