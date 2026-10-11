<?php

use App\Domain\Money\Decimal;
use App\Domain\Tax\EffectiveTax;
use App\Domain\Tax\LegalNotes;
use App\Domain\Tax\TaxContext;
use App\Domain\Tax\TaxRateData;
use App\Domain\Totals\GroupInput;
use App\Domain\Totals\PositionInput;
use App\Domain\Totals\TotalsCalculator;
use App\Enums\PositionKind;
use App\Enums\TaxationMode;
use App\Enums\TaxCategory;
use App\Enums\TaxTreatment;

function totalsCtx(TaxationMode $mode = TaxationMode::Regular, TaxTreatment $treatment = TaxTreatment::Domestic): TaxContext
{
    return new TaxContext(
        [new TaxRateData('r19', Decimal::of('19'), TaxCategory::S), new TaxRateData('r7', Decimal::of('7'), TaxCategory::S)],
        $mode,
        $treatment,
        new LegalNotes('small business note', 'reverse charge note', 'third country note'),
    );
}

function totalsPos(string $id, string $quantity = '1', string $price = '0', PositionKind $kind = PositionKind::Item, ?string $taxRateId = 'r19'): PositionInput
{
    return new PositionInput($id, $kind, 'X', Decimal::of($quantity), Decimal::of($price), 'u', $taxRateId);
}

/** @return list<GroupInput> */
function totalsLoose(PositionInput ...$positions): array
{
    return [new GroupInput('g0', null, array_values($positions))];
}

describe('EffectiveTax', function () {
    it('uses the rate for regular domestic customers', function () {
        $tax = EffectiveTax::resolve('r7', totalsCtx());

        expect((string) $tax?->percent)->toBe('7')
            ->and($tax?->category)->toBe(TaxCategory::S)
            ->and($tax?->note)->toBeNull();
    });

    it('forces E with the § 19 note for small businesses', function () {
        $tax = EffectiveTax::resolve('r19', totalsCtx(TaxationMode::SmallBusiness));

        expect($tax?->percent->isZero())->toBeTrue()
            ->and($tax?->category)->toBe(TaxCategory::E)
            ->and($tax?->note)->toBe('small business note');
    });

    it('forces AE for EU reverse charge and G for third countries', function () {
        expect(EffectiveTax::resolve('r19', totalsCtx(treatment: TaxTreatment::EuReverseCharge))?->category)->toBe(TaxCategory::AE)
            ->and(EffectiveTax::resolve('r19', totalsCtx(treatment: TaxTreatment::ThirdCountry))?->category)->toBe(TaxCategory::G);
    });

    it('returns null for an unknown or missing rate', function () {
        expect(EffectiveTax::resolve('gone', totalsCtx()))->toBeNull()
            ->and(EffectiveTax::resolve(null, totalsCtx()))->toBeNull();
    });
});

describe('TotalsCalculator', function () {
    it('sums lines and computes tax per rate group', function () {
        $t = TotalsCalculator::calculate(totalsLoose(
            totalsPos('a', '10', '95'),
            totalsPos('b', '1', '49.9', taxRateId: 'r7'),
        ), totalsCtx());

        expect((string) $t->lines['a']->net)->toBe('950.00')
            ->and($t->toArray()['tax_breakdown'])->toBe([
                ['category' => 'S', 'percent' => '19', 'net' => '950.00', 'tax' => '180.50', 'gross' => '1130.50'],
                ['category' => 'S', 'percent' => '7', 'net' => '49.90', 'tax' => '3.49', 'gross' => '53.39'],
            ])
            ->and((string) $t->net)->toBe('999.90')
            ->and((string) $t->tax)->toBe('183.99')
            ->and((string) $t->gross)->toBe('1183.89');
    });

    it('computes a subtotal per group and ignores text lines', function () {
        $t = TotalsCalculator::calculate([
            new GroupInput('g1', 'Konzept', [totalsPos('a', '2', '100'), totalsPos('t', '0', '0', PositionKind::Text)]),
            new GroupInput('g2', 'Umsetzung', [totalsPos('b', '1', '50'), totalsPos('o', '1', '30', PositionKind::Optional)]),
        ], totalsCtx());

        expect($t->toArray()['groups'])->toBe([
            'g1' => ['title' => 'Konzept', 'net' => '200.00', 'optional_net' => '0.00'],
            'g2' => ['title' => 'Umsetzung', 'net' => '50.00', 'optional_net' => '30.00'],
        ])
            ->and($t->lines)->not->toHaveKey('t')
            ->and((string) $t->net)->toBe('250.00');
    });

    it('excludes optional positions from the total', function () {
        $t = TotalsCalculator::calculate(totalsLoose(totalsPos('a', '1', '100'), totalsPos('o', '1', '300', PositionKind::Optional)), totalsCtx());

        expect((string) $t->net)->toBe('100.00')
            ->and((string) $t->optionalNet)->toBe('300.00');
    });

    it('collects legal notes once', function () {
        $t = TotalsCalculator::calculate(totalsLoose(totalsPos('a', '1', '10'), totalsPos('b', '1', '20')), totalsCtx(TaxationMode::SmallBusiness));

        expect((string) $t->tax)->toBe('0.00')
            ->and($t->legalNotes)->toBe(['small business note']);
    });

    it('handles negative quantities (cancellations)', function () {
        $t = TotalsCalculator::calculate(totalsLoose(totalsPos('a', '-10', '95')), totalsCtx());

        expect((string) $t->gross)->toBe('-1130.50');
    });

    it('treats a missing tax rate as 0 % and reports it', function () {
        $t = TotalsCalculator::calculate(totalsLoose(totalsPos('a', '1', '100', taxRateId: 'gone')), totalsCtx());

        expect((string) $t->tax)->toBe('0.00')
            ->and($t->missingTaxRate)->toBe(['a']);
    });

    it('rounds half away from zero without floating point drift', function () {
        $t = TotalsCalculator::calculate(totalsLoose(
            totalsPos('a', '3', '0.1'),
            totalsPos('b', '1', '0.005'),
            totalsPos('c', '-1', '0.005'),
        ), totalsCtx());

        expect((string) $t->lines['a']->net)->toBe('0.30')
            ->and((string) $t->lines['b']->net)->toBe('0.01')
            ->and((string) $t->lines['c']->net)->toBe('-0.01');
    });
});

describe('Decimal', function () {
    it('accepts integer and dot-decimal strings only', function (mixed $value, int $scale, bool $valid) {
        expect(Decimal::isValid($value, $scale))->toBe($valid);
    })->with([
        ['12', 4, true],
        [12, 4, true],
        ['-3.5', 4, true],
        ['0.0001', 4, true],
        ['0.00001', 4, false],
        ['12.345', 2, false],
        ['12,5', 4, false],
        [12.5, 4, false],
        ['1e3', 4, false],
        ['', 4, false],
        [null, 4, false],
        ['123456789012', 4, false],
    ]);
});
