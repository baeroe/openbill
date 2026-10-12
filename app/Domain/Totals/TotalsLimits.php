<?php

namespace App\Domain\Totals;

use Brick\Math\BigDecimal;

/**
 * What the database can store: document totals are DECIMAL(15,2), so no line, group or document amount may exceed
 * 13 integer digits. Inputs are bounded too (Decimal::isValid, DECIMAL(15,4)), but their products are not.
 */
final class TotalsLimits
{
    public const MAX = '9999999999999.99';

    /**
     * Positions and groups whose total is too large, and whether a document total (net, tax, gross, optional or a
     * tax row) is.
     *
     * @return array{lines: list<string>, groups: list<string>, document: bool}
     */
    public static function exceeded(Totals $totals): array
    {
        $lines = [];
        foreach ($totals->lines as $id => $line) {
            if (self::tooLarge($line->net)) {
                $lines[] = (string) $id;
            }
        }
        $groups = [];
        foreach ($totals->groups as $id => $group) {
            if (self::tooLarge($group->net) || self::tooLarge($group->optionalNet)) {
                $groups[] = (string) $id;
            }
        }
        $document = self::tooLarge($totals->net) || self::tooLarge($totals->tax) || self::tooLarge($totals->gross) || self::tooLarge($totals->optionalNet);
        foreach ($totals->taxBreakdown as $row) {
            $document = $document || self::tooLarge($row->net) || self::tooLarge($row->tax) || self::tooLarge($row->gross);
        }

        return ['lines' => $lines, 'groups' => $groups, 'document' => $document];
    }

    public static function tooLarge(BigDecimal $amount): bool
    {
        return $amount->abs()->isGreaterThan(BigDecimal::of(self::MAX));
    }
}
