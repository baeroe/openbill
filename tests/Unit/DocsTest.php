<?php

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
