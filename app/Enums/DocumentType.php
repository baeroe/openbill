<?php

namespace App\Enums;

enum DocumentType: string
{
    case Offer = 'offer';
    case Confirmation = 'confirmation';
    case Invoice = 'invoice';
    case Cancellation = 'cancellation';
}
