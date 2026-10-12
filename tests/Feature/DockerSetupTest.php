<?php

use Symfony\Component\Process\Process;
use Symfony\Component\Yaml\Yaml;

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
        ->and(dockerRepoFile('Dockerfile'))->toContain('COPY docs/en/templates.md ./docs/en/templates.md');
});

it('puts the built template kit where config(openbill.toolkit.path) looks for it', function () {
    expect(config('openbill.toolkit.path'))->toBe(base_path('packages/template-kit/dist/kit'))
        ->and(dockerRepoFile('Dockerfile'))->toContain('--from=assets /app/packages/template-kit/dist/kit ./packages/template-kit/dist/kit');
});

it('keeps secrets, dependencies and local caches out of the build context', function () {
    $ignore = array_map('trim', explode("\n", dockerRepoFile('.dockerignore')));

    expect($ignore)->toContain('.env', '.env.*', '**/node_modules', 'vendor', 'storage', 'bootstrap/cache/*.php', '.git', '.ddev', 'e2e', 'tests');
});

it('starts through the openbill entrypoint script in the right order', function () {
    $path = 'docker/entrypoint.d/99-openbill.sh';
    $script = dockerRepoFile($path);
    $steps = [
        'mkdir -p storage/app/private storage/app/public storage/app/archive',
        'KEY_FILE=storage/app/.app-key',
        'php artisan config:clear',
        'DB_WAIT_TIMEOUT',
        'php artisan migrate --force',
        'php artisan app:sync-templates',
        'php artisan app:ensure-admin',
        'php artisan optimize',
    ];
    $positions = array_map(fn (string $step): int|false => strpos($script, $step), $steps);
    $sorted = $positions;
    sort($sorted);

    expect(is_executable(base_path($path)))->toBeTrue()
        ->and(dockerRepoFile('Dockerfile'))->toContain('COPY --chmod=755 docker/entrypoint.d/ /etc/entrypoint.d/')
        ->and($positions)->not->toContain(false)
        ->and($positions)->toBe($sorted);
});

it('has an entrypoint script a POSIX shell accepts', function () {
    $process = new Process(['sh', '-n', base_path('docker/entrypoint.d/99-openbill.sh')]);
    $process->run();

    expect($process->getExitCode())->toBe(0, $process->getErrorOutput());
});

/** @return array<string, mixed> */
function dockerCompose(): array
{
    return Yaml::parse(dockerRepoFile('docker-compose.yml'));
}

it('runs openbill, MariaDB 11.4 and Gotenberg 8 with two persistent volumes', function () {
    $compose = dockerCompose();
    $services = $compose['services'];

    expect(array_keys($services))->toEqualCanonicalizing(['openbill', 'mariadb', 'gotenberg'])
        ->and($services['openbill']['image'])->toBe('${OPENBILL_IMAGE:-baeroe/openbill:latest}')
        ->and($services['openbill']['ports'])->toBe(['${OPENBILL_BIND:-127.0.0.1}:${OPENBILL_PORT:-7739}:8080'])
        ->and($services['openbill']['volumes'])->toBe(['openbill-data:/var/www/html/storage/app'])
        ->and($services['mariadb']['volumes'])->toBe(['openbill-db:/var/lib/mysql'])
        ->and(array_keys($compose['volumes']))->toEqualCanonicalizing(['openbill-data', 'openbill-db'])
        ->and($services['mariadb']['image'])->toMatch('/^mariadb:11\.4\.\d+@sha256:[0-9a-f]{64}$/')
        ->and($services['gotenberg']['image'])->toMatch('/^gotenberg\/gotenberg:8\.\d+\.\d+@sha256:[0-9a-f]{64}$/');
});

it('starts openbill only after MariaDB and Gotenberg report healthy', function () {
    $services = dockerCompose()['services'];

    expect($services['openbill']['depends_on'])->toBe([
        'mariadb' => ['condition' => 'service_healthy'],
        'gotenberg' => ['condition' => 'service_healthy'],
    ])
        ->and($services['mariadb']['healthcheck']['test'])->toContain('healthcheck.sh')
        ->and($services['gotenberg']['healthcheck']['test'])->toContain('http://localhost:3000/health');
});

it('lets MariaDB create the document lock triggers even with binary logging on', function () {
    expect(dockerCompose()['services']['mariadb']['command'])->toContain('--log-bin-trust-function-creators=1');
});

it('keeps MariaDB and Gotenberg off the host and the internet', function () {
    $compose = dockerCompose();

    foreach (['mariadb', 'gotenberg'] as $service) {
        expect($compose['services'][$service])->not->toHaveKey('ports')
            ->and($compose['services'][$service]['networks'])->toBe(['backend']);
    }
    expect($compose['networks']['backend']['internal'])->toBeTrue()
        ->and($compose['services']['openbill']['networks'])->toEqualCanonicalizing(['default', 'backend']);
});

it('runs Gotenberg with the same hardening flags as DDEV', function () {
    $ddev = Yaml::parse(dockerRepoFile('.ddev/docker-compose.gotenberg.yaml'));

    expect(dockerCompose()['services']['gotenberg']['command'])->toBe($ddev['services']['gotenberg']['command']);
});

it('documents every variable of the compose file in .env.docker.example', function () {
    preg_match_all('/\$\{([A-Z_]+)/', dockerRepoFile('docker-compose.yml'), $m);
    $example = dockerRepoFile('.env.docker.example');
    $names = array_values(array_unique($m[1]));

    expect($names)->toEqualCanonicalizing(['OPENBILL_IMAGE', 'OPENBILL_BIND', 'OPENBILL_PORT', 'TRUSTED_PROXIES', 'APP_KEY', 'APP_URL', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'DB_PASSWORD', 'DB_ROOT_PASSWORD']);
    foreach ($names as $name) {
        expect($example)->toMatch('/^#?\s*'.$name.'=/m');
    }
});

it('uses the same pinned Gotenberg and MariaDB images in DDEV, CI and Compose', function () {
    $services = dockerCompose()['services'];
    $ddev = Yaml::parse(dockerRepoFile('.ddev/docker-compose.gotenberg.yaml'));
    $ci = Yaml::parse(dockerRepoFile('.github/workflows/tests.yml'));

    expect($ddev['services']['gotenberg']['image'])->toBe($services['gotenberg']['image'])
        ->and($ci['jobs']['tests']['services']['mariadb']['image'])->toBe($services['mariadb']['image'])
        ->and(dockerRepoFile('.github/workflows/tests.yml'))->toContain('docker run -d --name gotenberg -p 3000:3000 '.$services['gotenberg']['image'].' gotenberg');
});

it('starts Gotenberg in CI with the hardening flags of DDEV', function () {
    $flags = array_slice(Yaml::parse(dockerRepoFile('.ddev/docker-compose.gotenberg.yaml'))['services']['gotenberg']['command'], 1);
    $workflow = dockerRepoFile('.github/workflows/tests.yml');

    expect($flags)->toHaveCount(5);
    foreach ($flags as $flag) {
        expect($workflow)->toContain($flag);
    }
});

it('pins the Java image of the e-invoice validator', function () {
    preg_match('/^JAVA_IMAGE=(\S+)$/m', dockerRepoFile('scripts/validate-einvoice.sh'), $m);

    expect($m[1] ?? '')->toMatch('/^eclipse-temurin:21[\w.-]*@sha256:[0-9a-f]{64}$/');
});

it('pins the PNG optimizer of the docs screenshots by digest', function () {
    preg_match('/^OXIPNG_IMAGE=(\S+)$/m', dockerRepoFile('e2e/optimize-screenshots.sh'), $m);

    expect($m[1] ?? '')->toMatch('/^ghcr\.io\/shssoichiro\/oxipng:v[\d.]+@sha256:[0-9a-f]{64}$/');
});

it('pins the KoSIT validator and its configuration by version and SHA-256', function () {
    $script = dockerRepoFile('scripts/validate-einvoice.sh');

    expect($script)->toMatch('/^KOSIT_VERSION=\d+\.\d+\.\d+$/m')
        ->toMatch('/^KOSIT_SHA256=[0-9a-f]{64}$/m')
        ->toMatch('/^KOSIT_CONFIG_VERSION=\d{4}-\d{2}-\d{2}$/m')
        ->toMatch('/^KOSIT_CONFIG_SHA256=[0-9a-f]{64}$/m')
        ->toContain('/releases/download/v${KOSIT_VERSION}/', '/releases/download/v${KOSIT_CONFIG_VERSION}/', "KOSIT_SCENARIO='EN16931 (CII)'");
});

it('keeps the code read-only for PHP and only storage and bootstrap/cache writable', function () {
    $dockerfile = dockerRepoFile('Dockerfile');
    $app = substr($dockerfile, (int) strpos($dockerfile, ' AS app'));

    expect($app)->not->toContain('--chown')
        ->toContain('chown -R www-data:www-data storage bootstrap/cache')
        ->and(strrpos($app, 'USER www-data'))->toBeGreaterThan((int) strrpos($app, 'chown -R www-data:www-data storage bootstrap/cache'));
});

it('publishes openbill on localhost only unless OPENBILL_BIND says otherwise', function () {
    expect(dockerCompose()['services']['openbill']['ports'][0])->toStartWith('${OPENBILL_BIND:-127.0.0.1}:')
        ->and(dockerRepoFile('.env.docker.example'))->toMatch('/^OPENBILL_BIND=127\.0\.0\.1$/m')
        ->and(dockerCompose()['services']['openbill']['environment']['TRUSTED_PROXIES'])->toBe('${TRUSTED_PROXIES:-}');
});

it('ships no usable passwords, so Compose refuses to start until the database ones are set', function () {
    $example = dockerRepoFile('.env.docker.example');
    $compose = dockerRepoFile('docker-compose.yml');

    foreach (['ADMIN_PASSWORD', 'DB_PASSWORD', 'DB_ROOT_PASSWORD'] as $name) {
        expect($example)->toMatch('/^'.$name.'=$/m');
    }
    foreach (['DB_PASSWORD', 'DB_ROOT_PASSWORD'] as $name) {
        expect($compose)->toContain('${'.$name.':?');
    }
});

it('needs ADMIN_PASSWORD only for the first start (review I2), so it can be removed from .env afterwards', function () {
    expect(dockerCompose()['services']['openbill']['environment']['ADMIN_PASSWORD'])->toBe('${ADMIN_PASSWORD:-}')
        ->and(dockerRepoFile('.env.docker.example'))->toContain('Remove ADMIN_PASSWORD once the owner exists')
        ->toContain('app:reset-password');
});

it('reports openbill healthy only when Laravel answers for the host of APP_URL', function () {
    $test = implode(' ', dockerCompose()['services']['openbill']['healthcheck']['test']);

    expect($test)->toContain('http://localhost:8080/up', 'Host: ', '${APP_URL#*://}');
});
