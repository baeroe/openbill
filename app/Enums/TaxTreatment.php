<?php

namespace App\Enums;

enum TaxTreatment: string
{
    case Domestic = 'domestic';
    case EuReverseCharge = 'eu_reverse_charge';
    case ThirdCountry = 'third_country';
}
