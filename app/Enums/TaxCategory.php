<?php

namespace App\Enums;

/** EN 16931 VAT category codes (UNTDID 5305). */
enum TaxCategory: string
{
    case S = 'S';
    case Z = 'Z';
    case E = 'E';
    case AE = 'AE';
    case K = 'K';
    case G = 'G';
}
