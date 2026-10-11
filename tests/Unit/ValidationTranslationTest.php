<?php

/**
 * lang/de/validation.php must cover every message of Laravel's English file, otherwise German pages and
 * API answers (Accept-Language: de) fall back to English for that rule.
 *
 * @return list<string>
 */
function validationKeys(array $lines, string $prefix = ''): array
{
    $keys = [];
    foreach ($lines as $key => $value) {
        if ($prefix === '' && in_array($key, ['custom', 'attributes'], true)) {
            continue;
        }
        $keys = is_array($value)
            ? [...$keys, ...validationKeys($value, "{$prefix}{$key}.")]
            : [...$keys, "{$prefix}{$key}"];
    }

    return $keys;
}

it('has a German text for every validation message of Laravel', function () {
    $root = dirname(__DIR__, 2);
    $en = require "{$root}/vendor/laravel/framework/src/Illuminate/Translation/lang/en/validation.php";
    $de = require "{$root}/lang/de/validation.php";

    expect(array_values(array_diff(validationKeys($en), validationKeys($de))))->toBe([])
        ->and(array_values(array_diff(validationKeys($de), validationKeys($en))))->toBe([]);
});

it('keeps the placeholders of every message', function () {
    $root = dirname(__DIR__, 2);
    $flatten = function (array $lines, string $prefix = '') use (&$flatten): array {
        $result = [];
        foreach ($lines as $key => $value) {
            if ($prefix === '' && in_array($key, ['custom', 'attributes'], true)) {
                continue;
            }
            $result = is_array($value) ? [...$result, ...$flatten($value, "{$prefix}{$key}.")] : [...$result, "{$prefix}{$key}" => $value];
        }

        return $result;
    };
    $placeholders = function (string $text): array {
        preg_match_all('/:[a-z_]+/', $text, $m);
        $list = array_values(array_unique($m[0]));
        sort($list);

        return $list;
    };
    $en = $flatten(require "{$root}/vendor/laravel/framework/src/Illuminate/Translation/lang/en/validation.php");
    $de = $flatten(require "{$root}/lang/de/validation.php");

    foreach ($en as $key => $text) {
        expect($placeholders($de[$key] ?? ''))->toBe($placeholders($text), "placeholders of {$key}");
    }
});
