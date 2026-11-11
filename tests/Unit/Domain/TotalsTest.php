<?php

use App\Domain\Money\Decimal;
use App\Domain\Tax\EffectiveTax;
use App\Domain\Tax\LegalNotes;
use App\Domain\Tax\TaxContext;
use App\Domain\Tax\TaxRateData;
use App\Domain\Totals\GroupInput;
use App\Domain\Totals\LineDiscount;
use App\Domain\Totals\PositionInput;
use App\Domain\Totals\TotalsCalculator;
use App\Domain\Totals\TotalsLimits;
use App\Enums\CustomerKind;
use App\Enums\DiscountType;
use App\Enums\PositionKind;
use App\Enums\SupplyType;
use App\Enums\TaxationMode;
use App\Enums\TaxCategory;
use App\Enums\TaxTreatment;

function totalsCtx(TaxationMode $mode = TaxationMode::Regular, TaxTreatment $treatment = TaxTreatment::Domestic, SupplyType $supply = SupplyType::Goods, CustomerKind $kind = CustomerKind::Business): TaxContext
{
    return new TaxContext(
        [new TaxRateData('r19', Decimal::of('19'), TaxCategory::S), new TaxRateData('r7', Decimal::of('7'), TaxCategory::S)],
        $mode,
        $treatment,
        new LegalNotes('small business note', 'reverse charge note', 'third country note', 'third country services note'),
        $supply,
        $kind,
    );
}

function totalsPos(string $id, string $quantity = '1', string $price = '0', PositionKind $kind = PositionKind::Item, ?string $taxRateId = 'r19'): PositionInput
{
    return new PositionInput($id, $kind, 'X', Decimal::of($quantity), Decimal::of($price), 'u', $taxRateId);
}

function discountPos(string $id, string $quantity, string $price, DiscountType $type, string $value, PositionKind $kind = PositionKind::Item, ?string $taxRateId = 'r19'): PositionInput
{
    return new PositionInput($id, $kind, 'X', Decimal::of($quantity), Decimal::of($price), 'u', $taxRateId, discount: new LineDiscount($type, Decimal::of($value)));
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

describe('line discounts', function () {
    it('takes a percentage off the line amount', function () {
        $t = TotalsCalculator::calculate(totalsLoose(discountPos('a', '10', '95', DiscountType::Percent, '10')), totalsCtx());

        expect($t->toArray()['lines']['a'])->toBe(['net' => '855.00', 'before_discount' => '950.00', 'discount' => '95.00', 'tax_percent' => '19', 'tax_category' => 'S'])
            ->and((string) $t->net)->toBe('855.00')
            ->and((string) $t->tax)->toBe('162.45')
            ->and((string) $t->gross)->toBe('1017.45');
    });

    it('takes a fixed amount off the line amount', function () {
        $t = TotalsCalculator::calculate(totalsLoose(discountPos('a', '3', '760', DiscountType::Amount, '280')), totalsCtx());

        expect((string) $t->lines['a']->beforeDiscount)->toBe('2280.00')
            ->and((string) $t->lines['a']->discount)->toBe('280.00')
            ->and((string) $t->lines['a']->net)->toBe('2000.00')
            ->and((string) $t->gross)->toBe('2380.00');
    });

    it('makes a line free with 100 % or the full amount', function () {
        $t = TotalsCalculator::calculate(totalsLoose(
            discountPos('a', '2', '49.95', DiscountType::Percent, '100'),
            discountPos('b', '1', '120', DiscountType::Amount, '120'),
            totalsPos('c', '1', '10'),
        ), totalsCtx());

        expect((string) $t->lines['a']->net)->toBe('0.00')
            ->and((string) $t->lines['a']->discount)->toBe('99.90')
            ->and((string) $t->lines['b']->net)->toBe('0.00')
            ->and((string) $t->net)->toBe('10.00')
            ->and((string) $t->gross)->toBe('11.90');
    });

    it('rounds the percentage of the rounded line amount half away from zero', function () {
        $t = TotalsCalculator::calculate(totalsLoose(
            discountPos('a', '1', '0.10', DiscountType::Percent, '5'),
            discountPos('b', '3', '0.333', DiscountType::Percent, '33.33'),
            discountPos('c', '-1', '0.10', DiscountType::Percent, '5'),
        ), totalsCtx());

        // 0.10 × 5 % = 0.005 → 0.01; 3 × 0.333 = 0.999 → 1.00, × 33.33 % = 0.3333 → 0.33
        expect((string) $t->lines['a']->discount)->toBe('0.01')
            ->and((string) $t->lines['a']->net)->toBe('0.09')
            ->and((string) $t->lines['b']->beforeDiscount)->toBe('1.00')
            ->and((string) $t->lines['b']->discount)->toBe('0.33')
            ->and((string) $t->lines['b']->net)->toBe('0.67')
            ->and((string) $t->lines['c']->discount)->toBe('-0.01')
            ->and((string) $t->lines['c']->net)->toBe('-0.09');
    });

    it('moves negative lines towards zero (cancellations mirror their invoice)', function () {
        $invoice = TotalsCalculator::calculate(totalsLoose(
            discountPos('a', '2', '85', DiscountType::Percent, '10'),
            discountPos('b', '5', '80', DiscountType::Amount, '50'),
        ), totalsCtx());
        $cancellation = TotalsCalculator::calculate(totalsLoose(
            discountPos('a', '-2', '85', DiscountType::Percent, '10'),
            discountPos('b', '-5', '80', DiscountType::Amount, '50'),
        ), totalsCtx());

        expect((string) $cancellation->lines['a']->net)->toBe('-153.00')
            ->and((string) $cancellation->lines['b']->discount)->toBe('-50.00')
            ->and((string) $cancellation->lines['b']->net)->toBe('-350.00')
            ->and((string) $cancellation->gross)->toBe((string) $invoice->gross->negated())
            ->and((string) $invoice->gross)->toBe('598.57');
    });

    it('mixes discounted lines with discount positions of a negative price', function () {
        $t = TotalsCalculator::calculate(totalsLoose(
            discountPos('a', '1', '1000', DiscountType::Percent, '15'),
            totalsPos('rebate', '1', '-100'),
            discountPos('b', '1', '-200', DiscountType::Amount, '20'),
        ), totalsCtx());

        expect((string) $t->lines['a']->net)->toBe('850.00')
            ->and((string) $t->lines['rebate']->net)->toBe('-100.00')
            ->and((string) $t->lines['rebate']->discount)->toBe('0.00')
            ->and((string) $t->lines['b']->net)->toBe('-180.00')
            ->and((string) $t->net)->toBe('570.00');
    });

    it('computes the tax per rate from the discounted lines', function () {
        $t = TotalsCalculator::calculate([
            new GroupInput('g1', 'Konzept', [discountPos('a', '1', '890', DiscountType::Percent, '10'), discountPos('b', '2', '50', DiscountType::Amount, '10', taxRateId: 'r7')]),
            new GroupInput('g2', 'Extras', [discountPos('o', '1', '300', DiscountType::Percent, '50', PositionKind::Optional)]),
        ], totalsCtx());

        expect($t->toArray()['tax_breakdown'])->toBe([
            ['category' => 'S', 'percent' => '19', 'net' => '801.00', 'tax' => '152.19', 'gross' => '953.19'],
            ['category' => 'S', 'percent' => '7', 'net' => '90.00', 'tax' => '6.30', 'gross' => '96.30'],
        ])
            ->and($t->toArray()['groups']['g1']['net'])->toBe('891.00')
            ->and($t->toArray()['groups']['g2']['optional_net'])->toBe('150.00')
            ->and((string) $t->optionalNet)->toBe('150.00');
    });

    it('discounts small-business invoices without VAT', function () {
        $t = TotalsCalculator::calculate(totalsLoose(discountPos('a', '4', '60', DiscountType::Percent, '25')), totalsCtx(TaxationMode::SmallBusiness));

        expect((string) $t->net)->toBe('180.00')
            ->and((string) $t->tax)->toBe('0.00')
            ->and((string) $t->gross)->toBe('180.00')
            ->and($t->legalNotes)->toBe(['small business note']);
    });

    it('reports discounts that exceed the line', function () {
        expect((new LineDiscount(DiscountType::Percent, Decimal::of('100')))->exceeds(Decimal::of('10.00')))->toBeFalse()
            ->and((new LineDiscount(DiscountType::Percent, Decimal::of('100.01')))->exceeds(Decimal::of('10.00')))->toBeTrue()
            ->and((new LineDiscount(DiscountType::Amount, Decimal::of('10.00')))->exceeds(Decimal::of('10.00')))->toBeFalse()
            ->and((new LineDiscount(DiscountType::Amount, Decimal::of('10.01')))->exceeds(Decimal::of('10.00')))->toBeTrue()
            ->and((new LineDiscount(DiscountType::Amount, Decimal::of('10.00')))->exceeds(Decimal::of('-10.00')))->toBeFalse()
            ->and((new LineDiscount(DiscountType::Amount, Decimal::of('0.01')))->exceeds(Decimal::of('0.00')))->toBeTrue();
    });

    it('leaves lines without a discount unchanged', function () {
        $t = TotalsCalculator::calculate(totalsLoose(totalsPos('a', '10', '95')), totalsCtx());

        expect($t->toArray()['lines']['a'])->toBe(['net' => '950.00', 'before_discount' => '950.00', 'discount' => '0.00', 'tax_percent' => '19', 'tax_category' => 'S']);
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
        [99999999999, 4, true],
        [-99999999999, 4, true],
        [123456789012, 4, false],
        [PHP_INT_MAX, 4, false],
        [PHP_INT_MIN, 4, false],
    ]);

    it('flags line, group and document totals the DECIMAL(15,2) columns cannot hold', function () {
        $fits = TotalsCalculator::calculate(totalsLoose(totalsPos('a', '1', '9999999999999.99')), totalsCtx(TaxationMode::SmallBusiness));
        $line = TotalsCalculator::calculate(totalsLoose(totalsPos('a', '99999999999', '99999999999'), totalsPos('b', '1', '1')), totalsCtx());
        $sum = TotalsCalculator::calculate(totalsLoose(totalsPos('a', '1', '9000000000000'), totalsPos('b', '1', '9000000000000')), totalsCtx(TaxationMode::SmallBusiness));
        $tax = TotalsCalculator::calculate(totalsLoose(totalsPos('a', '1', '9000000000000')), totalsCtx());

        expect(TotalsLimits::exceeded($fits))->toBe(['lines' => [], 'groups' => [], 'document' => false])
            ->and(TotalsLimits::exceeded($line)['lines'])->toBe(['a'])
            ->and(TotalsLimits::exceeded($sum))->toMatchArray(['lines' => [], 'document' => true])
            ->and(TotalsLimits::exceeded($sum)['groups'])->toHaveCount(1)
            ->and(TotalsLimits::exceeded($tax)['document'])->toBeTrue();
    });

    it('uses O with its own note for services to third-country customers, G for goods', function () {
        $services = EffectiveTax::resolve('r19', totalsCtx(treatment: TaxTreatment::ThirdCountry, supply: SupplyType::Services));
        $goods = EffectiveTax::resolve('r19', totalsCtx(treatment: TaxTreatment::ThirdCountry, supply: SupplyType::Goods));

        expect($services?->category)->toBe(TaxCategory::O)
            ->and((string) $services?->percent)->toBe('0')
            ->and($services?->note)->toBe('third country services note')
            ->and($goods?->category)->toBe(TaxCategory::G)
            ->and($goods?->note)->toBe('third country note');
    });

    it('taxes services to third-country consumers at the regular rate without a note (review #5)', function () {
        $consumer = EffectiveTax::resolve('r19', totalsCtx(treatment: TaxTreatment::ThirdCountry, supply: SupplyType::Services, kind: CustomerKind::Consumer));
        $goods = EffectiveTax::resolve('r19', totalsCtx(treatment: TaxTreatment::ThirdCountry, supply: SupplyType::Goods, kind: CustomerKind::Consumer));

        expect($consumer?->category)->toBe(TaxCategory::S)
            ->and((string) $consumer?->percent)->toBe('19')
            ->and($consumer?->note)->toBeNull()
            ->and($goods?->category)->toBe(TaxCategory::G);
    });
});
