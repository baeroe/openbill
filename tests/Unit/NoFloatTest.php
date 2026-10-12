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
    $previous = null;
    foreach (token_get_all($code) as $token) {
        if (! is_array($token)) {
            $previous = $token;

            continue;
        }
        [$id, $text, $line] = $token;
        // the name of a declared method (a Liquid filter called "round") is no float usage, nor is a class member
        // like the enum case RoundingMode::Floor (never PHP's global floor())
        $declared = $previous === T_FUNCTION || $previous === T_DOUBLE_COLON;
        if ($id === T_DNUMBER || $id === T_DOUBLE_CAST || (! $declared && $id === T_STRING && in_array(strtolower($text), $banned, true))) {
            $hits[] = "{$file}:{$line} {$text}";
        }
        if ($id !== T_WHITESPACE) {
            $previous = $id;
        }
    }

    return $hits;
}

it('detects floating point usage', function () {
    $code = '<?php function f(float $a): int { return (int) round((float) $a * 1.5) + floatval("1"); }';

    expect(floatUsages($code))->toBe(['code:1 float', 'code:1 round', 'code:1 (float)', 'code:1 1.5', 'code:1 floatval']);
});

it('does not count a method that is only called round as float usage', function () {
    expect(floatUsages('<?php class F { public function round(string $v): string { return $v; } }'))->toBe([])
        ->and(floatUsages('<?php $x = round($y);'))->toBe(['code:1 round'])
        ->and(floatUsages('<?php $x = $a->dividedBy($b, RoundingMode::Floor);'))->toBe([]);
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

it('never uses floating point in rendering and e-invoice code, except CiiAmount', function () {
    $root = dirname(__DIR__, 2).'/app';
    $hits = [];
    foreach (['Rendering', 'EInvoice'] as $dir) {
        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator("{$root}/{$dir}", FilesystemIterator::SKIP_DOTS));
        foreach ($files as $file) {
            $relative = substr($file->getPathname(), strlen($root) + 1);
            if ($file->getExtension() === 'php' && $relative !== 'EInvoice/CiiAmount.php') {
                array_push($hits, ...floatUsages((string) file_get_contents($file->getPathname()), $relative));
            }
        }
    }

    expect($hits)->toBe([]);
});
