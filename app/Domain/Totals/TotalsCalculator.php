<?php

namespace App\Domain\Totals;

use App\Domain\Money\Decimal;
use App\Domain\Tax\EffectiveTax;
use App\Domain\Tax\TaxContext;
use App\Enums\PositionKind;
use App\Enums\TaxCategory;
use Brick\Math\RoundingMode;

/** Port of calcTotals() from prototypes/clickdummy-v2/src/domain/totals.ts. */
final class TotalsCalculator
{
    /**
     * @param  list<GroupInput>  $groups
     */
    public static function calculate(array $groups, TaxContext $ctx): Totals
    {
        $lines = [];
        $groupTotals = [];
        $buckets = [];
        $notes = [];
        $missing = [];
        $optionalNet = Decimal::zero();

        foreach ($groups as $group) {
            $groupNet = Decimal::zero();
            $groupOptional = Decimal::zero();

            foreach ($group->positions as $p) {
                if ($p->kind === PositionKind::Text) {
                    continue;
                }

                $net = Decimal::round2($p->quantity->multipliedBy($p->unitPrice));
                $tax = EffectiveTax::resolve($p->taxRateId, $ctx);
                $lines[$p->id] = new LineTotal($p->id, $net, $tax);

                if ($p->kind === PositionKind::Optional) {
                    $optionalNet = $optionalNet->plus($net);
                    $groupOptional = $groupOptional->plus($net);

                    continue;
                }

                if ($tax === null) {
                    $missing[] = $p->id;
                }
                $groupNet = $groupNet->plus($net);

                $effective = $tax ?? new EffectiveTax(Decimal::zero(), TaxCategory::S, null);
                $key = $effective->category->value.':'.$effective->percent->strippedOfTrailingZeros();
                $buckets[$key] ??= ['category' => $effective->category, 'percent' => $effective->percent, 'net' => Decimal::zero()];
                $buckets[$key]['net'] = $buckets[$key]['net']->plus($net);

                if ($effective->note !== null && $effective->note !== '' && ! in_array($effective->note, $notes, true)) {
                    $notes[] = $effective->note;
                }
            }

            $groupTotals[$group->id] = new GroupTotal($group->id, $group->title, Decimal::round2($groupNet), Decimal::round2($groupOptional));
        }

        $rows = [];
        foreach ($buckets as $bucket) {
            $net = Decimal::round2($bucket['net']);
            $tax = $net->multipliedBy($bucket['percent'])->dividedBy(100, 2, RoundingMode::HalfUp);
            $rows[] = new TaxBreakdownRow($bucket['category'], $bucket['percent'], $net, $tax, $net->plus($tax));
        }
        usort($rows, fn (TaxBreakdownRow $a, TaxBreakdownRow $b): int => $b->percent->compareTo($a->percent));

        $net = Decimal::zero()->toScale(2);
        $tax = Decimal::zero()->toScale(2);
        foreach ($rows as $row) {
            $net = $net->plus($row->net);
            $tax = $tax->plus($row->tax);
        }

        return new Totals($lines, $groupTotals, $rows, $net, $tax, $net->plus($tax), Decimal::round2($optionalNet), $notes, $missing);
    }
}
