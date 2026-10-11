<?php

namespace App\Enums;

enum ComplianceProfile: string
{
    case Basic = 'basic';

    /** E-invoice (ZUGFeRD/XRechnung); invoices and cancellations only. */
    case En16931 = 'en16931';
}
