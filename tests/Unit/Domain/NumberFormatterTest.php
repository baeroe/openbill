<?php

use App\Domain\Numbering\NumberFormatter;

it('fills year, month and the padded sequence', function (string $pattern, string $date, int $sequence, string $expected) {
    expect(NumberFormatter::format($pattern, new DateTimeImmutable($date), $sequence))->toBe($expected);
})->with([
    ['RE-{YYYY}-{0000}', '2026-10-04', 5, 'RE-2026-0005'],
    ['{YY}/{MM}-{000}', '2026-03-01', 42, '26/03-042'],
    ['AN-{0000}', '2025-12-31', 7, 'AN-0007'],
    ['X-{00}', '2026-01-01', 123, 'X-123'],
    ['{YYYY}{MM}{0}', '2026-07-15', 9, '2026079'],
]);

it('knows valid patterns and patterns with a year', function () {
    expect(NumberFormatter::isValidPattern('RE-{0000}'))->toBeTrue()
        ->and(NumberFormatter::isValidPattern('RE-{YYYY}'))->toBeFalse()
        ->and(NumberFormatter::hasYear('RE-{YYYY}-{0000}'))->toBeTrue()
        ->and(NumberFormatter::hasYear('{YY}-{000}'))->toBeTrue()
        ->and(NumberFormatter::hasYear('RE-{MM}-{0000}'))->toBeFalse();
});
