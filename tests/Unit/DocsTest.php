<?php

use App\Support\TrustedRequests;

it('has every docs page in English and German', function () {
    $pages = fn (string $locale): array => array_map('basename', glob(dirname(__DIR__, 2)."/docs/{$locale}/*.md") ?: []);

    expect($pages('en'))->not->toBeEmpty()
        ->toEqualCanonicalizing($pages('de'));
});

it('lists every English page in the sidebar', function () {
    $root = dirname(__DIR__, 2);
    $config = (string) file_get_contents("{$root}/docs/.vitepress/config.ts");
    $pages = array_map(fn (string $f): string => basename($f, '.md'), glob("{$root}/docs/en/*.md") ?: []);

    foreach (array_diff($pages, ['index']) as $page) {
        expect($config)->toContain("'{$page}'");
    }
});

it('marks templates:render as read access to all documents in the API docs', function () {
    $root = dirname(__DIR__, 2);

    expect((string) file_get_contents("{$root}/docs/en/api.md"))->toContain('read access to all documents')
        ->and((string) file_get_contents("{$root}/docs/de/api.md"))->toContain('lesender Zugriff auf alle Dokumente');
});

it('explains the toolkit token, pnpm run pack and local certificates on the toolkit page', function () {
    $root = dirname(__DIR__, 2);

    expect((string) file_get_contents("{$root}/docs/en/template-toolkit.md"))
        ->toContain('read access to all documents', '.env.local', 'pnpm run pack', '--use-system-ca', 'pnpm pull --force')
        ->and((string) file_get_contents("{$root}/docs/de/template-toolkit.md"))
        ->toContain('lesender Zugriff auf alle Dokumente', '.env.local', 'pnpm run pack', '--use-system-ca', 'pnpm pull --force');
});

it('lists the trusted proxy networks, the APP_URL host rule and the body size on the reverse proxy page', function () {
    $root = dirname(__DIR__, 2);

    foreach (['en', 'de'] as $locale) {
        $page = (string) file_get_contents("{$root}/docs/{$locale}/reverse-proxy.md");
        foreach (TrustedRequests::PROXIES as $network) {
            expect($page)->toContain("`{$network}`");
        }
        expect($page)->toContain('APP_URL', 'client_max_body_size 32m', '127.0.0.1:7739', 'OPENBILL_BIND', 'TRUSTED_PROXIES', 'traefik.docker.network=proxy');
    }
});

it('documents backup and restore of the database and the data volume', function () {
    $root = dirname(__DIR__, 2);

    foreach (['en', 'de'] as $locale) {
        expect((string) file_get_contents("{$root}/docs/{$locale}/backup.md"))
            ->toContain('mariadb-dump', '--single-transaction', '--triggers', '/var/www/html/storage/app', '.app-key', 'down -v');
    }
});

it('explains binary logging for external databases and the data volume on the setup page', function () {
    $root = dirname(__DIR__, 2);

    foreach (['en', 'de'] as $locale) {
        expect((string) file_get_contents("{$root}/docs/{$locale}/setup.md"))
            ->toContain('log_bin_trust_function_creators', 'openbill-data', 'openbill-db', '7739', 'DB_WAIT_TIMEOUT', 'OPENBILL_BIND', 'TRUSTED_PROXIES', 'ADMIN_PASSWORD missing');
    }
});

it('has upgrade notes for the first release in both languages', function () {
    $root = dirname(__DIR__, 2);

    foreach (['en', 'de'] as $locale) {
        expect((string) file_get_contents("{$root}/docs/{$locale}/upgrading.md"))->toContain("\n### 0.1.0\n");
    }
});

it('builds the docs for GitHub Pages under /openbill/ and redirects relative to the base', function () {
    $root = dirname(__DIR__, 2);
    $workflow = (string) file_get_contents("{$root}/.github/workflows/docs.yml");

    expect((string) file_get_contents("{$root}/docs/.vitepress/config.ts"))->toContain('process.env.DOCS_BASE', 'process.env.DOCS_URL')
        ->and((string) file_get_contents("{$root}/docs/.vitepress/theme/index.ts"))->toContain('import.meta.env.BASE_URL')
        ->and($workflow)->toContain('DOCS_BASE: /openbill/', 'DOCS_URL: https://baeroe.github.io/openbill', 'actions/deploy-pages', 'fetch-depth: 0')
        ->and((string) file_get_contents("{$root}/.github/workflows/tests.yml"))->toContain('DOCS_BASE: /openbill/');
});

it('has the same documentation screenshots in English and German, the editor among them', function () {
    $root = dirname(__DIR__, 2);
    $shots = fn (string $locale): array => array_map('basename', glob("{$root}/docs/public/screenshots/{$locale}/*.png") ?: []);

    expect($shots('en'))->toContain('editor.png', 'editor-dark.png')
        ->toEqualCanonicalizing($shots('de'));
});
