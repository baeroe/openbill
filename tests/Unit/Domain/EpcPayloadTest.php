<?php

use App\Domain\Payment\EpcPayload;
use Brick\Math\BigDecimal;

function epc(string $name = 'Studio Nordlicht', string $iban = 'DE02120300000000202051', string $bic = 'BYLADEM1001', string $amount = '1189.41', string $reference = 'INV-2026-0042'): ?string
{
    return EpcPayload::build($name, $iban, $bic, BigDecimal::of($amount), $reference);
}

it('writes the lines of EPC069-12 version 002 (UTF-8, SCT, unstructured remittance)', function () {
    expect(explode("\n", (string) epc()))->toBe([
        'BCD', '002', '1', 'SCT', 'BYLADEM1001', 'Studio Nordlicht', 'DE02120300000000202051', 'EUR1189.41', '', '', 'INV-2026-0042',
    ]);
});

it('normalizes IBAN, BIC and amount', function () {
    $lines = explode("\n", (string) epc(iban: 'de02 1203 0000 0000 2020 51', bic: 'byla dem1 001', amount: '5'));

    expect($lines[4])->toBe('BYLADEM1001')
        ->and($lines[6])->toBe('DE02120300000000202051')
        ->and($lines[7])->toBe('EUR5.00');
});

it('leaves out an empty or malformed BIC (optional in version 002)', function (string $bic) {
    expect(explode("\n", (string) epc(bic: $bic))[4])->toBe('');
})->with(['', 'NOTABIC', 'BYLADEM1001X']);

it('cuts the name to 70 and the reference to 140 characters and keeps them on one line', function () {
    $lines = explode("\n", (string) epc(name: str_repeat('A', 75), reference: "Rechnung\r\n".str_repeat('x', 200)));

    expect($lines)->toHaveCount(11)
        ->and($lines[5])->toBe(str_repeat('A', 70))
        ->and($lines[10])->toBe('Rechnung '.str_repeat('x', 131));
});

it('shortens a multibyte reference further until the payload fits into 331 bytes', function () {
    $payload = (string) epc(name: str_repeat('Ä', 70), reference: str_repeat('ß', 140));

    expect(strlen($payload))->toBeLessThanOrEqual(EpcPayload::MAX_BYTES)
        ->and(strlen($payload))->toBeGreaterThan(EpcPayload::MAX_BYTES - 2)
        ->and(mb_check_encoding($payload, 'UTF-8'))->toBeTrue()
        ->and(explode("\n", $payload)[10])->toMatch('/^ß+$/u');
});

it('drops trailing empty lines when there is no reference', function () {
    expect(explode("\n", (string) epc(reference: '')))->toHaveCount(8);
});

it('stays within 331 bytes even with the longest fields', function () {
    expect(strlen((string) epc(name: str_repeat('Ä', 80), iban: 'MT84MALT011000012345MTLCAST001S', amount: '999999999.99', reference: str_repeat('Ü', 200))))
        ->toBeLessThanOrEqual(331);
});

it('describes no transfer without name, with an invalid IBAN or an amount out of range', function (array $args) {
    expect(epc(...$args))->toBeNull();
})->with([
    'no name' => [['name' => '  ']],
    'no IBAN' => [['iban' => '']],
    'invalid IBAN' => [['iban' => 'not an iban']],
    'zero' => [['amount' => '0']],
    'below a cent' => [['amount' => '0.004']],
    'negative' => [['amount' => '-10']],
    'too large' => [['amount' => '1000000000.00']],
]);

it('accepts the limits of the amount', function () {
    expect(explode("\n", (string) epc(amount: '0.01'))[7])->toBe('EUR0.01')
        ->and(explode("\n", (string) epc(amount: '999999999.99'))[7])->toBe('EUR999999999.99');
});
