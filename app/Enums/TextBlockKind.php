<?php

namespace App\Enums;

enum TextBlockKind: string
{
    case Intro = 'intro';
    case Closing = 'closing';
    case Payment = 'payment';
    case Note = 'note';
}
