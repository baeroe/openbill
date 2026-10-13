<?php

namespace App\Domain\Payment;

use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;

/**
 * Content of a GiroCode (EPC QR code) after EPC069-12 v3.1: service tag BCD, version 002, UTF-8, SEPA credit
 * transfer, lines separated by LF. Only the unstructured remittance (line 11) is used; trailing empty
 * lines are left out. Null when no valid transfer can be described (no name, no IBAN, amount out of range).
 */
final class EpcPayload
{
    public const NAME_MAX = 70;

    public const REMITTANCE_MAX = 140;

    /** Whole payload in bytes (UTF-8): multibyte names and references can exceed it within their character limits. */
    public const MAX_BYTES = 331;

    public const MIN_AMOUNT = '0.01';

    public const MAX_AMOUNT = '999999999.99';

    public static function build(string $name, string $iban, string $bic, BigDecimal $amount, string $remittance): ?string
    {
        $name = self::text($name, self::NAME_MAX);
        $iban = self::compact($iban);
        $bic = self::compact($bic);
        if ($name === '' || preg_match('/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/', $iban) !== 1) {
            return null;
        }
        // BIC is optional in version 002; a malformed one is dropped rather than making the code unusable
        if (preg_match('/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/', $bic) !== 1) {
            $bic = '';
        }
        $amount = $amount->toScale(2, RoundingMode::HalfUp);
        if ($amount->isLessThan(self::MIN_AMOUNT) || $amount->isGreaterThan(self::MAX_AMOUNT)) {
            return null;
        }

        $head = implode("\n", ['BCD', '002', '1', 'SCT', $bic, $name, $iban, 'EUR'.$amount, '', '', '']);
        $remittance = self::text($remittance, self::REMITTANCE_MAX);
        // the reference gives way first, character by character
        while ($remittance !== '' && strlen($head.$remittance) > self::MAX_BYTES) {
            $remittance = trim(mb_substr($remittance, 0, -1, 'UTF-8'));
        }

        return rtrim($head.$remittance, "\n");
    }

    /** One line, cut to $max characters (not bytes). */
    private static function text(string $value, int $max): string
    {
        $value = trim((string) preg_replace('/\s+/u', ' ', $value));

        return trim(mb_substr($value, 0, $max, 'UTF-8'));
    }

    private static function compact(string $value): string
    {
        return strtoupper((string) preg_replace('/\s+/', '', $value));
    }
}
