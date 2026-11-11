<?php

namespace App\Enums;

/** How a position's discount is given. */
enum DiscountType: string
{
    /** Share of the line amount, 0 to 100. */
    case Percent = 'percent';

    /** Fixed amount in the document currency, at most the line amount. */
    case Amount = 'amount';
}
