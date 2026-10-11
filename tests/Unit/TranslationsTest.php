<?php

it('has the same keys in English and German', function () {
    $keys = fn (string $locale): array => array_keys(json_decode(
        (string) file_get_contents(dirname(__DIR__, 2)."/lang/{$locale}.json"),
        true,
        flags: JSON_THROW_ON_ERROR,
    ));

    expect(array_values(array_diff($keys('en'), $keys('de'))))->toBe([], 'missing in de.json')
        ->and(array_values(array_diff($keys('de'), $keys('en'))))->toBe([], 'missing in en.json');
});

it('defines every key used in code', function () {
    $root = dirname(__DIR__, 2);
    $en = json_decode((string) file_get_contents("{$root}/lang/en.json"), true, flags: JSON_THROW_ON_ERROR);
    $files = [
        ...(glob("{$root}/resources/js/{,*/,*/*/,*/*/*/}*.{ts,tsx}", GLOB_BRACE) ?: []),
        ...(glob("{$root}/app/{,*/,*/*/,*/*/*/}*.php", GLOB_BRACE) ?: []),
        ...(glob("{$root}/resources/views/*.blade.php") ?: []),
    ];
    $code = implode("\n", array_map(fn (string $file): string => (string) file_get_contents($file), $files));

    preg_match_all("/\\b(t|tn|__)\\(\\s*'([a-z_]+(?:\\.[a-z_]+)+)'/", $code, $matches, PREG_SET_ORDER);
    $used = array_values(array_unique(array_merge(...array_map(
        fn (array $m): array => $m[1] === 'tn' ? ["{$m[2]}.one", "{$m[2]}.other"] : [$m[2]],
        $matches,
    ))));

    expect($used)->not->toBeEmpty('texts should go through t()/tn()/__()')
        ->and(array_values(array_diff($used, array_keys($en))))->toBe([]);
});
