<?php

namespace App\Enums;

enum TaxationMode: string
{
    case Regular = 'regular';

    /** § 19 UStG: no VAT, category E, legal note on every document. */
    case SmallBusiness = 'small_business';
}
