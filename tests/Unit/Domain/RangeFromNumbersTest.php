<?php

use App\Domain\Numbering\RangeFromNumbers;

it('continues the existing customer numbers', function (array $numbers, string $pattern, int $next) {
    expect(RangeFromNumbers::guess($numbers))->toBe(['pattern' => $pattern, 'next_value' => $next]);
})->with([
    'no customers' => [[], 'C-{0000}', 1001],
    'numbers openbill handed out' => [['C-1001', 'C-1002'], 'C-{0000}', 1003],
    'own prefix' => [['K-1004', 'C-1001', 'Hafenkontor'], 'K-{0000}', 1005],
    'beyond the counter limit' => [['KD-000123456'], 'C-{0000}', 1001],
    'more digits' => [['K-12345', 'K-1006'], 'K-{00000}', 12346],
    'below 1000 as before' => [['K-0042'], 'C-{0000}', 1001],
    'braces never become placeholders' => [['{X}-5000'], 'C-{0000}', 1001],
]);
