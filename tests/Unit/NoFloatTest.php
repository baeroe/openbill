<?php

/**
 * Lines in $code that use floating point: the float type or cast, float literals, floatval(),
 * BigNumber::toFloat() and the float-returning rounding helpers.
 *
 * @return list<string>
 */
function floatUsages(string $code, string $file = 'code'): array
{
    $banned = ['float', 'floatval', 'tofloat', 'round', 'floor', 'ceil', 'fdiv', 'number_format'];
    $hits = [];
    foreach (token_get_all($code) as $token) {
        if (! is_array($token)) {
            continue;
        }
        [$id, $text, $line] = $token;
        if ($id === T_DNUMBER || $id === T_DOUBLE_CAST || ($id === T_STRING && in_array(strtolower($text), $banned, true))) {
            $hits[] = "{$file}:{$line} {$text}";
        }
    }

    return $hits;
}

it('detects floating point usage', function () {
    $code = '<?php function f(float $a): int { return (int) round((float) $a * 1.5) + floatval("1"); }';

    expect(floatUsages($code))->toBe(['code:1 float', 'code:1 round', 'code:1 (float)', 'code:1 1.5', 'code:1 floatval']);
});

it('never uses floating point in app/Domain', function () {
    $root = dirname(__DIR__, 2).'/app/Domain';
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
    $hits = [];
    foreach ($files as $file) {
        if ($file->getExtension() === 'php') {
            array_push($hits, ...floatUsages((string) file_get_contents($file->getPathname()), substr($file->getPathname(), strlen($root) + 1)));
        }
    }

    expect($hits)->toBe([]);
});
