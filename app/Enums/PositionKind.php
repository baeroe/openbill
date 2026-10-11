<?php

namespace App\Enums;

enum PositionKind: string
{
    /** Billable line. */
    case Item = 'item';

    /** Text line without amount. */
    case Text = 'text';

    /** Offers only; does not count towards the total. */
    case Optional = 'optional';
}
