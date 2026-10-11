<?php

use App\Domain\Compliance\ComplianceRule;
use App\Domain\Fields\FieldErrorCode;
use App\Support\Problem;

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

it('has a message for every domain code', function () {
    $root = dirname(__DIR__, 2);
    $keys = fn (string $locale): array => array_keys(json_decode((string) file_get_contents("{$root}/lang/{$locale}.json"), true, flags: JSON_THROW_ON_ERROR));
    $needed = [
        ...array_map(fn ($c) => "compliance.{$c->value}", ComplianceRule::cases()),
        ...array_map(fn ($c) => "fields.error.{$c->value}", FieldErrorCode::cases()),
    ];

    expect(array_values(array_diff($needed, $keys('en'))))->toBe([])
        ->and(array_values(array_diff($needed, $keys('de'))))->toBe([]);
});

it('has a text for every problem title and API message', function () {
    $root = dirname(__DIR__, 2);
    $needed = [
        ...array_map(fn (string $slug): string => "api.problem.{$slug}", array_values(Problem::SLUGS)),
        'api.problem.http_error', 'api.problem.server_error_detail', 'api.problem.invalid_json',
        'api.problem.body_not_object', 'api.problem.missing_ability',
    ];

    foreach (['en', 'de'] as $locale) {
        $keys = array_keys(json_decode((string) file_get_contents("{$root}/lang/{$locale}.json"), true, flags: JSON_THROW_ON_ERROR));
        expect(array_values(array_diff($needed, $keys)))->toBe([], "missing in {$locale}.json");
    }
});
