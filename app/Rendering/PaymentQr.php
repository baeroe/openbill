<?php

namespace App\Rendering;

use chillerlan\QRCode\Common\EccLevel;
use chillerlan\QRCode\Output\QROutputInterface;
use chillerlan\QRCode\QRCode;
use chillerlan\QRCode\QROptions;

/**
 * GiroCode as an SVG data URL (templates may only load data: URLs). The payload goes in as one byte segment
 * without ECI header: EPC069-12 declares the character set in the payload itself (line 3, "1" = UTF-8),
 * and an ECI segment confuses some banking apps. Error correction M as the EPC guideline requires.
 * The data URL is base64 only (A–Z, a–z, 0–9, +, /, =), so HTML escaping in LiquidRenderer leaves it as is.
 */
final class PaymentQr
{
    /** QR settings; the tests decode a PNG made with the same settings. */
    public const OPTIONS = [
        'eccLevel' => EccLevel::M,
        'addQuietzone' => true,
        'quietzoneSize' => 4,
    ];

    public static function dataUrl(string $payload): string
    {
        $options = new QROptions([
            ...self::OPTIONS,
            'outputType' => QROutputInterface::MARKUP_SVG,
            'outputBase64' => true,
            'svgAddXmlHeader' => false,
            'drawLightModules' => false,
            'connectPaths' => true,
            'eol' => '',
        ]);

        return (string) (new QRCode($options))->addByteSegment($payload)->render();
    }
}
