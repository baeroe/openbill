<?php

namespace App\Enums;

/**
 * Business or private customer. Only matters for services to third-country customers: a business gets them not
 * subject to German VAT (category O, § 3a (2) UStG), a consumer pays the regular rate (place of supply Germany,
 * § 3a (1) UStG).
 */
enum CustomerKind: string
{
    case Business = 'business';
    case Consumer = 'consumer';
}
